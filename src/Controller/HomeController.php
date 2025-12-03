<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Repository\EventRepository;
use App\Repository\DocumentRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

class HomeController extends AbstractController
{
    public function __construct(
        private UserRepository $userRepository,
        private EventRepository $eventRepository,
        private DocumentRepository $documentRepository,
    ) {
    }

    #[Route('/', name: 'app_home')]
    #[IsGranted('ROLE_USER')]
    public function __invoke(): Response
    {
        $user = $this->getUser();
        $isManagerOrAdmin = false;
        
        if ($user instanceof User) {
            $roles = $user->getRoles();
            $isManagerOrAdmin = in_array(User::ROLE_MANAGER, $roles) || in_array(User::ROLE_ADMIN, $roles);
        }

        // Get statistics
        $totalUsers = count($this->userRepository->findAll());
        $activeEmployees = count($this->userRepository->findBy(['status' => 'Actif']));
        
        // Get upcoming events (next 30 days)
        $upcomingEvents = $this->eventRepository->createQueryBuilder('e')
            ->where('e.date >= :now')
            ->andWhere('e.date <= :future')
            ->setParameter('now', new \DateTime())
            ->setParameter('future', new \DateTime('+30 days'))
            ->orderBy('e.date', 'ASC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult();

        return $this->render('home/index.html.twig', [
            'isManagerOrAdmin' => $isManagerOrAdmin,
            'stats' => [
                'totalUsers' => $totalUsers,
                'activeEmployees' => $activeEmployees,
                'pendingRequests' => 0, // Placeholder
            ],
            'upcomingEvents' => $upcomingEvents,
        ]);
    }
}

