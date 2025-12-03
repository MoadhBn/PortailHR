// Global state
let messages = [];
let deleteMessageId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    setupContactForm();
    
    if (typeof isManagerOrAdmin !== 'undefined' && isManagerOrAdmin) {
        loadMessages();
        setupDeleteModal();
    }
    
    // Pre-fill form with user data if available
    if (typeof currentUser !== 'undefined' && currentUser.name && currentUser.email) {
        const nameInput = document.getElementById('contact-name');
        const emailInput = document.getElementById('contact-email');
        if (nameInput) nameInput.value = currentUser.name;
        if (emailInput) emailInput.value = currentUser.email;
    }
});

// Accordion functionality
function toggleAccordion(button) {
    const item = button.closest('.accordion-item');
    const isActive = item.classList.contains('active');
    
    // Close all accordion items
    document.querySelectorAll('.accordion-item').forEach(accItem => {
        accItem.classList.remove('active');
    });
    
    // Open clicked item if it wasn't active
    if (!isActive) {
        item.classList.add('active');
    }
}

// Setup contact form
function setupContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('contact-name').value.trim(),
            email: document.getElementById('contact-email').value.trim(),
            subject: document.getElementById('contact-subject').value.trim(),
            message: document.getElementById('contact-message').value.trim()
        };
        
        // Validate
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            alert('Veuillez remplir tous les champs');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert('Veuillez entrer une adresse email valide');
            return;
        }
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';
        
        try {
            const response = await fetch('/contact/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Votre message a été envoyé avec succès. Notre équipe vous répondra dans les plus brefs délais.');
                form.reset();
                
                // Reload messages if admin/manager
                if (typeof isManagerOrAdmin !== 'undefined' && isManagerOrAdmin) {
                    loadMessages();
                }
            } else {
                alert(data.error || 'Erreur lors de l\'envoi du message');
            }
        } catch (error) {
            console.error('Error submitting message:', error);
            alert('Erreur lors de l\'envoi du message');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// Load messages (Managers/Admins only)
async function loadMessages() {
    const tableBody = document.getElementById('messagesTableBody');
    if (!tableBody) {
        console.error('messagesTableBody element not found');
        return;
    }
    
    try {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center"><p class="loading">Chargement des messages...</p></td></tr>';
        
        const statusFilter = document.getElementById('statusFilter');
        const status = statusFilter ? statusFilter.value : 'all';
        
        const url = status === 'all' 
            ? '/contact/messages'
            : `/contact/messages?status=${status}`;
        
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            messages = Array.isArray(data) ? data : [];
            console.log('Loaded messages:', messages);
            renderMessages();
        } else {
            const errorText = await response.text();
            console.error('Error response:', response.status, errorText);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center"><p class="loading">Erreur lors du chargement des messages (Code: ' + response.status + ')</p></td></tr>';
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        const tableBody = document.getElementById('messagesTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center"><p class="loading">Erreur lors du chargement des messages: ' + error.message + '</p></td></tr>';
        }
    }
}

// Render messages table
function renderMessages() {
    const tableBody = document.getElementById('messagesTableBody');
    if (!tableBody) {
        console.error('messagesTableBody not found');
        return;
    }
    
    if (!messages || messages.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center"><p class="loading">Aucun message trouvé</p></td></tr>';
        return;
    }
    
    let html = '';
    messages.forEach(message => {
        const statusLabels = {
            'new': 'Nouveau',
            'reviewed': 'Consulté',
            'archived': 'Archivé'
        };
        
        // Handle date safely
        let dateStr = 'N/A';
        if (message.date) {
            try {
                const date = new Date(message.date + 'T00:00:00');
                if (!isNaN(date.getTime())) {
                    dateStr = date.toLocaleDateString('fr-FR');
                }
            } catch (e) {
                console.error('Error parsing date:', e);
            }
        }
        
        html += `
            <tr>
                <td>
                    <span class="status-badge ${message.status || 'new'}">${statusLabels[message.status] || message.status || 'Nouveau'}</span>
                </td>
                <td class="font-medium">${escapeHtml(message.name || '')}</td>
                <td class="text-muted">${escapeHtml(message.email || '')}</td>
                <td>${escapeHtml(message.subject || '')}</td>
                <td class="text-muted">${dateStr}</td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn-action" onclick="viewMessage(${message.id})" title="Consulter">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${message.status !== 'archived' ? `
                        <button class="btn-action" onclick="archiveMessage(${message.id})" title="Archiver">
                            <i class="fas fa-archive"></i>
                        </button>
                        ` : ''}
                        <button class="btn-action delete" onclick="confirmDeleteMessage(${message.id}, '${escapeHtml(message.subject || '')}')" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Filter messages
function filterMessages() {
    loadMessages();
}

// View message
async function viewMessage(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const modal = document.getElementById('viewMessageModal');
    const subject = document.getElementById('viewMessageSubject');
    const name = document.getElementById('viewMessageName');
    const email = document.getElementById('viewMessageEmail');
    const date = document.getElementById('viewMessageDate');
    const content = document.getElementById('viewMessageContent');
    
    if (modal && subject && name && email && date && content) {
        subject.textContent = message.subject || '';
        name.textContent = message.name || '';
        email.textContent = message.email || '';
        
        // Handle date safely
        let dateStr = 'Date non disponible';
        if (message.date) {
            try {
                const messageDate = new Date(message.date + 'T00:00:00');
                if (!isNaN(messageDate.getTime())) {
                    dateStr = messageDate.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            } catch (e) {
                console.error('Error parsing date:', e);
            }
        }
        date.textContent = dateStr;
        content.textContent = message.message || '';
        
        modal.style.display = 'flex';
        
        // Mark as reviewed if it's new (after showing modal)
        if (message.status === 'new') {
            await updateMessageStatus(messageId, 'reviewed');
            loadMessages(); // Reload to update the table
        }
    }
}

// Close view message modal
function closeViewMessageModal() {
    const modal = document.getElementById('viewMessageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Archive message
async function archiveMessage(messageId) {
    try {
        const response = await fetch(`/contact/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'archived' })
        });
        
        if (response.ok) {
            loadMessages();
        } else {
            alert('Erreur lors de l\'archivage du message');
        }
    } catch (error) {
        console.error('Error archiving message:', error);
        alert('Erreur lors de l\'archivage du message');
    }
}

// Update message status
async function updateMessageStatus(messageId, status) {
    try {
        const response = await fetch(`/contact/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: status })
        });
        
        if (response.ok) {
            // Update local state
            const message = messages.find(m => m.id === messageId);
            if (message) {
                message.status = status;
            }
        }
    } catch (error) {
        console.error('Error updating message status:', error);
    }
}

// Confirm delete message
function confirmDeleteMessage(messageId, subject) {
    deleteMessageId = messageId;
    const modal = document.getElementById('deleteMessageModal');
    const deleteText = document.getElementById('deleteMessageText');
    
    if (modal && deleteText) {
        deleteText.textContent = `Voulez-vous vraiment supprimer le message "${subject}" ?`;
        modal.style.display = 'flex';
    }
}

// Close delete modal
function closeDeleteMessageModal() {
    const modal = document.getElementById('deleteMessageModal');
    if (modal) {
        modal.style.display = 'none';
        deleteMessageId = null;
    }
}

// Setup delete modal
function setupDeleteModal() {
    const confirmBtn = document.getElementById('confirmDeleteMessageBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', executeDeleteMessage);
    }
}

// Execute delete message
async function executeDeleteMessage() {
    if (!deleteMessageId) return;
    
    try {
        const response = await fetch(`/contact/messages/${deleteMessageId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            closeDeleteMessageModal();
            loadMessages();
        } else {
            alert('Erreur lors de la suppression du message');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        alert('Erreur lors de la suppression du message');
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    const modals = ['viewMessageModal', 'deleteMessageModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target === modal) {
            if (modalId === 'viewMessageModal') {
                closeViewMessageModal();
            } else if (modalId === 'deleteMessageModal') {
                closeDeleteMessageModal();
            }
        }
    });
});

// Close modals with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeViewMessageModal();
        closeDeleteMessageModal();
    }
});