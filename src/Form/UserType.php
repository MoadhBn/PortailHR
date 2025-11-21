<?php

namespace App\Form;

use App\Entity\User;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\NumberType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\Extension\Core\Type\FileType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\Length;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\File;

class UserType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('firstName', TextType::class, [
                'label' => 'Prénom',
                'required' => true,
                'attr' => [
                'maxlength' => 25, 
                ],
            ])
            ->add('lastName', TextType::class, [
                'label' => 'Nom',
                'required' => true,
                'attr' => [
                'maxlength' => 25, 
                ],
            ])
            ->add('email', EmailType::class, [
                'label' => 'Email',
                'required' => true,
                'attr' => [
                'maxlength' => 25, 
                ],
            ])
            ->add('password', PasswordType::class, [
                'label' => 'Mot de passe',
                'required' => $options['require_password'],
                'mapped' => false,
                'constraints' => $options['require_password'] ? [
                    new NotBlank([
                        'message' => 'Veuillez entrer un mot de passe',
                    ]),
                    new Length([
                        'min' => 6,
                        'minMessage' => 'Votre mot de passe doit contenir au moins {{ limit }} caractères',
                        'max' => 4096,
                    ]),
                ] : [],
            ])
            ->add('dob', DateType::class, [
                'label' => 'Date de naissance',
                'widget' => 'single_text',
                'required' => true,
            ])
            ->add('phone', TextType::class, [
                'label' => 'Téléphone',
                'required' => false,
                'attr' => [
                'maxlength' => 8, 
                ],
            ])
            ->add('post', TextType::class, [
                'label' => 'Poste',
                'required' => false,
                'attr' => [
                'maxlength' => 50, 
                ],
            ])
            ->add('service', TextType::class, [
                'label' => 'Service',
                'required' => false,
                'attr' => [
                'maxlength' => 25, 
                ],
            ])
            ->add('supervisor', ChoiceType::class, [
                'label' => 'Supérieur hiérarchique',
                'required' => false,
                'mapped' => false,
                'choices' => $options['supervisor_choices'] ?? [],
                'placeholder' => 'Aucun (Direction)',
                'choice_label' => function ($user) {
                    if ($user instanceof \App\Entity\User) {
                        return ($user->getFirstName() ?? '') . ' ' . ($user->getLastName() ?? '');
                    }
                    return (string) $user;
                },
            ])
            ->add('salary', NumberType::class, [
                'label' => 'Salaire',
                'required' => false,
                'scale' => 3,
                'attr' => [
                'maxlength' => 10, 
                ],
                'constraints' => [
                new Length([
                'max' => 8,
                    'maxMessage' => 'Le salaire ne peut pas dépasser 8 chiffres.',
                ]),
            ],
            ])
            ->add('roles', ChoiceType::class, [
                'label' => 'Rôles',
                'choices' => [
                    'Utilisateur' => User::ROLE_USER,
                    'Manager' => User::ROLE_MANAGER,
                    'Administrateur' => User::ROLE_ADMIN,
                ],
                'expanded' => true,
                'multiple' => true,
                'required' => true,
            ])
            ->add('status', ChoiceType::class, [
                'label' => 'État',
                'choices' => [
                    'Actif' => 'Actif',
                    'Inactif' => 'Inactif',
                    'En congé' => 'En congé',
                ],
                'required' => true,
            ])
            ->add('photo', FileType::class, [
                'label' => 'Photo',
                'mapped' => false,
                'required' => false,
                'constraints' => [
                    new File([
                        'maxSize' => '5M',
                        'mimeTypes' => [
                            'image/jpeg',
                            'image/png',
                            'image/gif',
                            'image/webp',
                        ],
                        'mimeTypesMessage' => 'Veuillez télécharger une image valide (JPEG, PNG, GIF ou WEBP).',
                    ]),
                ],
            ])
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => User::class,
            'require_password' => true,
            'supervisor_choices' => [],
        ]);
    }
}


