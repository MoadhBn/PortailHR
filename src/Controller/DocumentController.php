<?php

namespace App\Controller;

use App\Entity\Document;
use App\Entity\User;
use App\Repository\DocumentRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\Exception\FileException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/documents', name: 'app_document_')]
class DocumentController extends AbstractController
{
    public function __construct(
        private DocumentRepository $documentRepository,
        private EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function list(): JsonResponse
    {
        $documents = $this->documentRepository->findBy([], ['uploadedAt' => 'DESC']);
        
        $documentsData = array_map(function (Document $document) {
            $uploadedBy = $document->getUploadedBy();
            return [
                'id' => $document->getId(),
                'title' => $document->getTitle(),
                'uploadedBy' => $uploadedBy ? trim(($uploadedBy->getFirstName() ?? '') . ' ' . ($uploadedBy->getLastName() ?? '')) : 'Unknown',
                'uploadDate' => $document->getUploadedAt()?->format('Y-m-d'),
                'fileSize' => $document->getFileSize() ?? 'N/A',
                'category' => $document->getCategory() ?? 'General',
            ];
        }, $documents);

        return $this->json($documentsData);
    }

    #[Route('', name: 'upload', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGER')]
    public function upload(Request $request): JsonResponse
    {
        try {
            // Check if file was uploaded
            if (!$request->files->has('file')) {
                return $this->json(['error' => 'Aucun fichier téléchargé. Veuillez sélectionner un fichier PDF.'], 400);
            }

            $uploadedFile = $request->files->get('file');
            
            if (!$uploadedFile || !$uploadedFile->isValid()) {
                $error = $uploadedFile ? $uploadedFile->getError() : 'UNKNOWN';
                $errorMessages = [
                    UPLOAD_ERR_INI_SIZE => 'Le fichier dépasse la taille maximale autorisée par PHP',
                    UPLOAD_ERR_FORM_SIZE => 'Le fichier dépasse la taille maximale autorisée par le formulaire',
                    UPLOAD_ERR_PARTIAL => 'Le fichier n\'a été que partiellement téléchargé',
                    UPLOAD_ERR_NO_FILE => 'Aucun fichier n\'a été téléchargé',
                    UPLOAD_ERR_NO_TMP_DIR => 'Dossier temporaire manquant',
                    UPLOAD_ERR_CANT_WRITE => 'Échec de l\'écriture du fichier sur le disque',
                    UPLOAD_ERR_EXTENSION => 'Une extension PHP a arrêté le téléchargement du fichier',
                ];
                return $this->json(['error' => $errorMessages[$error] ?? 'Erreur lors du téléchargement du fichier'], 400);
            }

            // Validate file type (PDF only)
            $mimeType = $uploadedFile->getMimeType();
            $extension = strtolower($uploadedFile->getClientOriginalExtension());
            
            // More lenient PDF validation
            $allowedMimeTypes = ['application/pdf', 'application/x-pdf', 'application/acrobat', 'applications/vnd.pdf', 'text/pdf', 'text/x-pdf'];
            
            if ($extension !== 'pdf' && !in_array($mimeType, $allowedMimeTypes)) {
                return $this->json([
                    'error' => 'Seuls les fichiers PDF sont autorisés. Type détecté: ' . $mimeType . ', Extension: ' . $extension
                ], 400);
            }

            // Get file size BEFORE moving the file (important!)
            $fileSize = $uploadedFile->getSize();
            
            // Validate file size (max 10MB)
            $maxSize = 10 * 1024 * 1024; // 10MB
            if ($fileSize > $maxSize) {
                return $this->json([
                    'error' => 'La taille du fichier (' . $this->formatFileSize($fileSize) . ') dépasse la limite de 10 Mo'
                ], 400);
            }

            // Get original filename before moving
            $originalFilename = pathinfo($uploadedFile->getClientOriginalName(), PATHINFO_FILENAME);
            $formattedFileSize = $this->formatFileSize($fileSize);

            $projectDir = $this->getParameter('kernel.project_dir');
            $uploadDir = $projectDir . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'documents';

            // Ensure directory exists with proper permissions
            if (!is_dir($uploadDir)) {
                if (!mkdir($uploadDir, 0775, true)) {
                    return $this->json(['error' => 'Échec de la création du répertoire de téléchargement: ' . $uploadDir], 500);
                }
            }

            // Check if directory is writable
            if (!is_writable($uploadDir)) {
                return $this->json(['error' => 'Le répertoire de téléchargement n\'est pas accessible en écriture'], 500);
            }

            $safeFilename = preg_replace('/[^A-Za-z0-9_\-]/', '_', $originalFilename) ?: 'document';
            $newFilename = sprintf('%s_%s.%s', $safeFilename, uniqid(), 'pdf');

            try {
                $uploadedFile->move($uploadDir, $newFilename);
            } catch (FileException $e) {
                return $this->json(['error' => 'Échec du téléchargement du fichier: ' . $e->getMessage()], 500);
            }

            // Verify file was moved successfully
            $fullPath = $uploadDir . DIRECTORY_SEPARATOR . $newFilename;
            if (!file_exists($fullPath)) {
                return $this->json(['error' => 'Le fichier n\'a pas pu être sauvegardé'], 500);
            }

            // Get file size from the moved file as fallback (in case temp file was cleaned up)
            if (empty($formattedFileSize)) {
                $actualFileSize = filesize($fullPath);
                $formattedFileSize = $this->formatFileSize($actualFileSize);
            }

            $document = new Document();
            $title = $request->request->get('title');
            if (empty($title)) {
                $title = $originalFilename;
            }
            $document->setTitle($title);
            $document->setFilePath('uploads/documents/' . $newFilename);
            $document->setCategory($request->request->get('category', 'General'));
            $document->setFileSize($formattedFileSize);
            $document->setUploadedAt(new \DateTime());
            $document->setUploadedBy($this->getUser());

            $this->entityManager->persist($document);
            $this->entityManager->flush();

            $uploadedBy = $document->getUploadedBy();
            return $this->json([
                'success' => true,
                'document' => [
                    'id' => $document->getId(),
                    'title' => $document->getTitle(),
                    'uploadedBy' => $uploadedBy ? trim(($uploadedBy->getFirstName() ?? '') . ' ' . ($uploadedBy->getLastName() ?? '')) : 'Unknown',
                    'uploadDate' => $document->getUploadedAt()?->format('Y-m-d'),
                    'fileSize' => $document->getFileSize(),
                    'category' => $document->getCategory(),
                ],
            ], 201);
        } catch (\Exception $e) {
            return $this->json(['error' => 'Erreur serveur: ' . $e->getMessage()], 500);
        }
    }

    #[Route('/{id}/download', name: 'download', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function download(Document $document): Response
    {
        $projectDir = $this->getParameter('kernel.project_dir');
        $filePath = $projectDir . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . $document->getFilePath();

        if (!file_exists($filePath)) {
            throw $this->createNotFoundException('File not found');
        }

        $response = new Response(file_get_contents($filePath));
        $response->headers->set('Content-Type', 'application/pdf');
        $disposition = $response->headers->makeDisposition(
            ResponseHeaderBag::DISPOSITION_ATTACHMENT,
            $document->getTitle() . '.pdf'
        );
        $response->headers->set('Content-Disposition', $disposition);

        return $response;
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    #[IsGranted('ROLE_MANAGER')]
    public function delete(Document $document): JsonResponse
    {
        // Delete the file from the filesystem
        $projectDir = $this->getParameter('kernel.project_dir');
        $filePath = $projectDir . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . $document->getFilePath();
        
        if (file_exists($filePath)) {
            @unlink($filePath);
        }

        $this->entityManager->remove($document);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }

    private function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        } elseif ($bytes >= 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }
        return $bytes . ' B';
    }
}

