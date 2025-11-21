<?php

namespace App\Controller;

use App\Entity\User;
use App\Form\UserType;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\HttpFoundation\File\Exception\FileException;
use Symfony\Component\Form\FormInterface;

#[Route('/gestion-utilisateurs', name: 'app_user_management_')]
#[IsGranted('ROLE_ADMIN')]
class UserManagementController extends AbstractController
{
    public function __construct(
        private UserRepository $userRepository,
        private EntityManagerInterface $entityManager,
        private UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    #[Route('', name: 'index', methods: ['GET', 'POST'])]
    public function index(Request $request): Response
    {
        $search = $request->query->get('search', '');
        $users = $this->userRepository->findAll();

        // Create form for adding new user
        $newUser = new User();
        $newUser->setRoles([User::ROLE_USER]);
        $newUser->setStatus('Actif');
        // Filter to only show managers and admins as supervisor options
        $allUsers = $this->userRepository->findAll();
        $supervisorChoices = array_filter($allUsers, function(User $user) {
            $roles = $user->getRoles();
            return in_array(User::ROLE_MANAGER, $roles) || in_array(User::ROLE_ADMIN, $roles);
        });
        $addForm = $this->createForm(UserType::class, $newUser, [
            'require_password' => true,
            'supervisor_choices' => $supervisorChoices,
        ]);
        $addForm->handleRequest($request);

        if ($addForm->isSubmitted() && $addForm->isValid()) {
            // Hash password if provided
            $plainPassword = $addForm->get('password')->getData();
            if ($plainPassword) {
                $newUser->setPassword($this->passwordHasher->hashPassword($newUser, $plainPassword));
            }

            // Handle supervisor - convert User object to full name string
            $supervisorUser = $addForm->get('supervisor')->getData();
            if ($supervisorUser instanceof User) {
                $newUser->setSupervisor(trim(($supervisorUser->getFirstName() ?? '') . ' ' . ($supervisorUser->getLastName() ?? '')));
            } else {
                $newUser->setSupervisor(null);
            }

            try {
                $this->handlePhotoUpload($addForm, $newUser);
            } catch (FileException $e) {
                $this->addFlash('error', 'Erreur lors du téléchargement de la photo : ' . $e->getMessage());

                return $this->redirectToRoute('app_user_management_index');
            }

            $this->entityManager->persist($newUser);
            $this->entityManager->flush();

            $this->addFlash('success', 'Employé créé avec succès.');

            return $this->redirectToRoute('app_user_management_index');
        }

        // Filter users by search term
        if ($search) {
            $users = array_filter($users, function (User $user) use ($search) {
                $fullName = strtolower(($user->getFirstName() ?? '') . ' ' . ($user->getLastName() ?? ''));
                $email = strtolower($user->getEmail() ?? '');
                $searchLower = strtolower($search);
                
                return str_contains($fullName, $searchLower) || str_contains($email, $searchLower);
            });
        }

        return $this->render('user_management/index.html.twig', [
            'users' => $users,
            'search' => $search,
            'addForm' => $addForm,
        ]);
    }

    #[Route('/new', name: 'new', methods: ['GET', 'POST'])]
    public function new(Request $request): Response
    {
        $user = new User();
        $user->setRoles([User::ROLE_USER]);
        $user->setStatus('Actif');
        // Filter to only show managers and admins as supervisor options
        $allUsers = $this->userRepository->findAll();
        $supervisorChoices = array_filter($allUsers, function(User $user) {
            $roles = $user->getRoles();
            return in_array(User::ROLE_MANAGER, $roles) || in_array(User::ROLE_ADMIN, $roles);
        });
        $form = $this->createForm(UserType::class, $user, [
            'require_password' => true,
            'supervisor_choices' => $supervisorChoices,
        ]);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            // Hash password if provided
            $plainPassword = $form->get('password')->getData();
            if ($plainPassword) {
                $user->setPassword($this->passwordHasher->hashPassword($user, $plainPassword));
            }

            // Handle supervisor - convert User object to full name string
            $supervisorUser = $form->get('supervisor')->getData();
            if ($supervisorUser instanceof User) {
                $user->setSupervisor(trim(($supervisorUser->getFirstName() ?? '') . ' ' . ($supervisorUser->getLastName() ?? '')));
            } else {
                $user->setSupervisor(null);
            }

            try {
                $this->handlePhotoUpload($form, $user);
            } catch (FileException $e) {
                $this->addFlash('error', 'Erreur lors du téléchargement de la photo : ' . $e->getMessage());

                return $this->redirectToRoute('app_user_management_index');
            }

            $this->entityManager->persist($user);
            $this->entityManager->flush();

            $this->addFlash('success', 'Employé créé avec succès.');

            return $this->redirectToRoute('app_user_management_index');
        }

        return $this->render('user_management/new.html.twig', [
            'user' => $user,
            'form' => $form,
        ]);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Request $request, User $user): Response
    {
        // If it's an AJAX request, return just the modal content
        if ($request->isXmlHttpRequest()) {
            return $this->render('user_management/show.html.twig', [
                'user' => $user,
            ]);
        }

        return $this->render('user_management/show.html.twig', [
            'user' => $user,
        ]);
    }

    #[Route('/{id}/edit', name: 'edit', methods: ['GET', 'POST'])]
    public function edit(Request $request, User $user): Response
    {
        // Get all users except the current one for supervisor selection
        // Filter to only show managers and admins as supervisor options
        $allUsers = $this->userRepository->findAll();
        $supervisorChoices = array_filter($allUsers, function(User $u) use ($user) {
            if ($u->getId() === $user->getId()) {
                return false;
            }
            $roles = $u->getRoles();
            return in_array(User::ROLE_MANAGER, $roles) || in_array(User::ROLE_ADMIN, $roles);
        });
        $allUsers = $supervisorChoices;
        
        // Find the supervisor user by matching the supervisor name
        $supervisorUser = null;
        $originalSupervisor = $user->getSupervisor();
        if ($user->getSupervisor()) {
            foreach ($allUsers as $potentialSupervisor) {
                $fullName = trim(($potentialSupervisor->getFirstName() ?? '') . ' ' . ($potentialSupervisor->getLastName() ?? ''));
                if (trim($fullName) === trim($user->getSupervisor())) {
                    $supervisorUser = $potentialSupervisor;
                    break;
                }
            }
        }
        
        $form = $this->createForm(UserType::class, $user, [
            'require_password' => false,
            'supervisor_choices' => $allUsers,
        ]);
        
        $form->handleRequest($request);
        
        // Set the supervisor field to the User object if found (after handleRequest to avoid conflicts)
        if (!$form->isSubmitted() && $supervisorUser) {
            $form->get('supervisor')->setData($supervisorUser);
        }

        if ($form->isSubmitted() && $form->isValid()) {
            // Hash password if provided
            $plainPassword = $form->get('password')->getData();
            if ($plainPassword) {
                $user->setPassword($this->passwordHasher->hashPassword($user, $plainPassword));
            }

            // Handle supervisor - convert User object to full name string
            $supervisorUser = $form->get('supervisor')->getData();
            if ($supervisorUser instanceof User) {
                $user->setSupervisor(trim(($supervisorUser->getFirstName() ?? '') . ' ' . ($supervisorUser->getLastName() ?? '')));
            } else {
                $user->setSupervisor(null);
            }

            try {
                $this->handlePhotoUpload($form, $user);
            } catch (FileException $e) {
                $this->addFlash('error', 'Erreur lors du téléchargement de la photo : ' . $e->getMessage());

                return $this->redirectToRoute('app_user_management_index');
            }

            $this->entityManager->flush();

            $this->addFlash('success', 'Employé modifié avec succès.');

            return $this->redirectToRoute('app_user_management_index');
        }

        // If it's an AJAX request, return just the modal content
        if ($request->isXmlHttpRequest() && $request->isMethod('GET')) {
            return $this->render('user_management/edit.html.twig', [
                'user' => $user,
                'form' => $form,
            ]);
        }

        return $this->render('user_management/edit.html.twig', [
            'user' => $user,
            'form' => $form,
        ]);
    }

    #[Route('/{id}', name: 'delete', methods: ['POST'])]
    public function delete(Request $request, User $user): Response
    {
        $token = $request->request->get('_token');
        if ($this->isCsrfTokenValid('delete' . $user->getId(), $token)) {
            $this->entityManager->remove($user);
            $this->entityManager->flush();

            $this->addFlash('success', 'Employé supprimé avec succès.');
        } else {
            $this->addFlash('error', 'Token CSRF invalide.');
        }

        return $this->redirectToRoute('app_user_management_index');
    }

    /**
     * @throws FileException
     */
    private function handlePhotoUpload(FormInterface $form, User $user): void
    {
        $photoFile = $form->get('photo')->getData();

        if (!$photoFile) {
            return;
        }

        $projectDir = $this->getParameter('kernel.project_dir');
        $uploadDir = $projectDir . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'users';

        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
            throw new FileException(sprintf('Impossible de créer le dossier de téléchargement "%s".', $uploadDir));
        }

        $originalFilename = pathinfo($photoFile->getClientOriginalName(), PATHINFO_FILENAME);
        $safeFilename = preg_replace('/[^A-Za-z0-9_\-]/', '_', $originalFilename) ?: 'photo';
        $extension = $photoFile->guessExtension() ?: $photoFile->getClientOriginalExtension() ?: 'bin';
        $newFilename = sprintf('%s_%s.%s', $safeFilename, uniqid(), $extension);

        try {
            $photoFile->move($uploadDir, $newFilename);
        } catch (FileException $e) {
            throw new FileException('Impossible de sauvegarder le fichier téléchargé.', 0, $e);
        }

        $currentPhoto = $user->getPhoto();
        if ($currentPhoto && str_starts_with($currentPhoto, 'uploads/users/')) {
            $existingPath = $projectDir . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . $currentPhoto;
            if (is_file($existingPath)) {
                @unlink($existingPath);
            }
        }

        $user->setPhoto('uploads/users/' . $newFilename);
    }
}

