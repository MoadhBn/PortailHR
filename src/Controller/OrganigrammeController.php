<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/organigramme', name: 'app_organigramme_')]
#[IsGranted('ROLE_USER')]
class OrganigrammeController extends AbstractController
{
    public function __construct(
        private UserRepository $userRepository,
        private EntityManagerInterface $entityManager,
        private UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(): Response
    {
        return $this->render('organigramme/index.html.twig');
    }

    #[Route('/data', name: 'data', methods: ['GET'])]
    public function getData(): JsonResponse
    {
        // Filter to only show managers and admins
        $allUsers = $this->userRepository->findAll();
        $users = array_filter($allUsers, function(User $user) {
            $roles = $user->getRoles();
            return in_array(User::ROLE_MANAGER, $roles) || in_array(User::ROLE_ADMIN, $roles);
        });
        
        $employees = $this->buildTree($users);

        return $this->json([
            'employees' => $employees,
        ]);
    }

    #[Route('/add', name: 'add', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    public function add(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $user = new User();
        $user->setFirstName($data['firstName'] ?? '');
        $user->setLastName($data['lastName'] ?? '');
        $user->setEmail($data['email']);
        $user->setPhone($data['phone'] ?? null);
        $user->setPost($data['position']);
        $user->setService($data['department']);
        $user->setSupervisor($data['superiorId'] ? $this->userRepository->find($data['superiorId'])?->getFirstName() . ' ' . $this->userRepository->find($data['superiorId'])?->getLastName() : null);
        // Set as Manager by default (can be changed in user management)
        $user->setRoles([User::ROLE_MANAGER]);
        $user->setStatus('Actif');
        // Set a default password (should be changed on first login)
        $user->setPassword($this->passwordHasher->hashPassword($user, 'password123'));

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $this->json([
            'success' => true,
            'employee' => $this->userToArray($user),
        ]);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    #[IsGranted('ROLE_ADMIN')]
    public function update(User $user, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (isset($data['firstName'])) {
            $user->setFirstName($data['firstName']);
        }
        if (isset($data['lastName'])) {
            $user->setLastName($data['lastName']);
        }
        if (isset($data['email'])) {
            $user->setEmail($data['email']);
        }
        if (isset($data['phone'])) {
            $user->setPhone($data['phone']);
        }
        if (isset($data['position'])) {
            $user->setPost($data['position']);
        }
        if (isset($data['department'])) {
            $user->setService($data['department']);
        }
        if (isset($data['superiorId'])) {
            $superior = $data['superiorId'] ? $this->userRepository->find($data['superiorId']) : null;
            $user->setSupervisor($superior ? $superior->getFirstName() . ' ' . $superior->getLastName() : null);
        }

        $this->entityManager->flush();

        return $this->json([
            'success' => true,
            'employee' => $this->userToArray($user),
        ]);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    #[IsGranted('ROLE_ADMIN')]
    public function delete(User $user): JsonResponse
    {
        $this->entityManager->remove($user);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }

    private function buildTree(array $users): array
    {
        $userMap = [];
        $rootUsers = [];
        $superiorMap = [];
        
        // Get all managers and admins for supervisor matching
        $allManagersAdmins = array_filter($this->userRepository->findAll(), function(User $user) {
            $roles = $user->getRoles();
            return in_array(User::ROLE_MANAGER, $roles) || in_array(User::ROLE_ADMIN, $roles);
        });

        // Create a map of all users and find superior IDs
        foreach ($users as $user) {
            $userMap[$user->getId()] = $this->userToArray($user);
            
            // Build superior map by matching supervisor names (only from managers/admins)
            $supervisorName = $user->getSupervisor();
            if ($supervisorName) {
                foreach ($allManagersAdmins as $potentialParent) {
                    $fullName = trim(($potentialParent->getFirstName() ?? '') . ' ' . ($potentialParent->getLastName() ?? ''));
                    if (trim($fullName) === trim($supervisorName)) {
                        // Only set superior if the supervisor is also a manager/admin
                        if (in_array($potentialParent->getId(), array_map(fn($u) => $u->getId(), $users))) {
                            $superiorMap[$user->getId()] = (string) $potentialParent->getId();
                        }
                        break;
                    }
                }
            }
        }

        // Update superiorId in userMap
        foreach ($superiorMap as $userId => $superiorId) {
            if (isset($userMap[$userId])) {
                $userMap[$userId]['superiorId'] = $superiorId;
            }
        }

        // Build parent-child relationships (only between managers/admins)
        foreach ($users as $user) {
            $supervisorName = $user->getSupervisor();
            $parentId = null;

            if ($supervisorName) {
                // Only look for supervisors within the managers/admins list
                foreach ($users as $potentialParent) {
                    $fullName = trim(($potentialParent->getFirstName() ?? '') . ' ' . ($potentialParent->getLastName() ?? ''));
                    if (trim($fullName) === trim($supervisorName)) {
                        $parentId = $potentialParent->getId();
                        break;
                    }
                }
            }

            if ($parentId && isset($userMap[$parentId])) {
                if (!isset($userMap[$parentId]['children'])) {
                    $userMap[$parentId]['children'] = [];
                }
                $userMap[$parentId]['children'][] = &$userMap[$user->getId()];
            } else {
                $rootUsers[] = &$userMap[$user->getId()];
            }
        }

        return $rootUsers;
    }

    private function userToArray(User $user): array
    {
        return [
            'id' => (string) $user->getId(),
            'name' => trim(($user->getFirstName() ?? '') . ' ' . ($user->getLastName() ?? '')),
            'firstName' => $user->getFirstName() ?? '',
            'lastName' => $user->getLastName() ?? '',
            'email' => $user->getEmail() ?? '',
            'phone' => $user->getPhone() ?? '',
            'position' => $user->getPost() ?? '',
            'department' => $user->getService() ?? '',
            'superiorId' => null, // Will be set in buildTree
            'children' => [],
        ];
    }
}

