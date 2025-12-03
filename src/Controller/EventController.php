<?php

namespace App\Controller;

use App\Entity\Event;
use App\Entity\User;
use App\Repository\EventRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/events', name: 'app_event_')]
class EventController extends AbstractController
{
    public function __construct(
        private EventRepository $eventRepository,
        private EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function list(): JsonResponse
    {
        $events = $this->eventRepository->findAll();
        
        $eventsData = array_map(function (Event $event) {
            return [
                'id' => $event->getId(),
                'title' => $event->getTitle(),
                'date' => $event->getDate()?->format('Y-m-d\TH:i:s'),
                'location' => $event->getLocation() ?? 'N/A',
                'type' => $event->getType(),
            ];
        }, $events);

        return $this->json($eventsData);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    #[IsGranted('ROLE_MANAGER')]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!isset($data['title']) || !isset($data['date']) || !isset($data['type'])) {
            return $this->json(['error' => 'Missing required fields'], 400);
        }

        $event = new Event();
        $event->setTitle($data['title']);
        $event->setDate(new \DateTime($data['date']));
        $event->setLocation($data['location'] ?? null);
        $event->setType($data['type']);
        $event->setCreatedAt(new \DateTime());
        $event->setCreatedBy($this->getUser());

        $this->entityManager->persist($event);
        $this->entityManager->flush();

        return $this->json([
            'success' => true,
            'event' => [
                'id' => $event->getId(),
                'title' => $event->getTitle(),
                'date' => $event->getDate()?->format('Y-m-d\TH:i:s'),
                'location' => $event->getLocation() ?? 'N/A',
                'type' => $event->getType(),
            ],
        ], 201);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    #[IsGranted('ROLE_MANAGER')]
    public function delete(Event $event): JsonResponse
    {
        $this->entityManager->remove($event);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }
}






