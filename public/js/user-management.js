// Modal management
function openAddModal() {
    const modal = document.getElementById('addModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeAddModal() {
    const modal = document.getElementById('addModal');
    if (modal) {
        modal.style.display = 'none';
        // Reset form
        const form = document.getElementById('addForm');
        if (form) {
            form.reset();
        }
    }
}

function viewEmployee(userId) {
    const modal = document.getElementById('viewModal');
    const modalContent = document.getElementById('viewModalContent');
    
    if (!modal || !modalContent) return;
    
    // Fetch user data via AJAX
    fetch(`/gestion-utilisateurs/${userId}`, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.text())
    .then(html => {
        modalContent.innerHTML = html;
        modal.style.display = 'flex';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Erreur lors du chargement des données de l\'employé');
    });
}

function closeViewModal() {
    const modal = document.getElementById('viewModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function editEmployee(userId) {
    const modal = document.getElementById('editModal');
    const modalContent = document.getElementById('editModalContent');
    
    if (!modal || !modalContent) return;
    
    // Fetch edit form via AJAX
    fetch(`/gestion-utilisateurs/${userId}/edit`, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.text())
    .then(html => {
        modalContent.innerHTML = html;
        modal.style.display = 'flex';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Erreur lors du chargement du formulaire de modification');
    });
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function deleteEmployee(userId, userName, csrfToken) {
    const modal = document.getElementById('deleteModal');
    const deleteMessage = document.getElementById('deleteMessage');
    const deleteForm = document.getElementById('deleteForm');
    const deleteToken = document.getElementById('deleteToken');
    
    if (!modal || !deleteMessage || !deleteForm || !deleteToken) return;
    
    // Set message
    deleteMessage.textContent = `Voulez-vous vraiment supprimer ${userName} ?`;
    
    // Set form action and CSRF token
    deleteForm.action = `/gestion-utilisateurs/${userId}`;
    deleteToken.value = csrfToken;
    deleteToken.name = '_token'; // Symfony will validate using the token value
    
    modal.style.display = 'flex';
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Filter employees
function filterEmployees() {
    const searchInput = document.getElementById('searchInput');
    const employeeCards = document.querySelectorAll('.employee-card');
    
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    
    employeeCards.forEach(card => {
        const name = card.getAttribute('data-name') || '';
        const email = card.getAttribute('data-email') || '';
        
        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    const modals = ['addModal', 'viewModal', 'editModal', 'deleteModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Close modals with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAddModal();
        closeViewModal();
        closeEditModal();
        closeDeleteModal();
    }
});

// Handle edit form submission via AJAX
document.addEventListener('submit', function(event) {
    const form = event.target;
    if (form.id === 'editForm') {
        event.preventDefault();
        
        const formData = new FormData(form);
        const url = form.action;
        
        fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (response.redirected) {
                window.location.href = response.url;
            } else {
                return response.text();
            }
        })
        .then(html => {
            if (html) {
                // If there are validation errors, update the modal content
                const modalContent = document.getElementById('editModalContent');
                if (modalContent) {
                    modalContent.innerHTML = html;
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Erreur lors de la modification de l\'employé');
        });
    }
});

