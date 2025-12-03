// Global state
let events = [];
let documents = [];
let currentSelectedDate = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateCurrentDate();
    loadEvents();
    loadDocuments();
    renderCalendar();
    
    // Setup event form
    if (typeof isManagerOrAdmin !== 'undefined' && isManagerOrAdmin) {
        setupEventForm();
        setupDocumentForm();
    }
});

// Global variables for delete modal
let deleteType = null; // 'event' or 'document'
let deleteId = null;

// Update current date display
function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const now = new Date();
        dateElement.textContent = now.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Load events from API
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        if (response.ok) {
            events = await response.json();
            renderCalendar();
        }
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

// Load documents from API
async function loadDocuments() {
    const documentsList = document.getElementById('documents-list');
    if (!documentsList) return;
    
    try {
        documentsList.innerHTML = '<p class="loading">Chargement des documents...</p>';
        const response = await fetch('/api/documents');
        if (response.ok) {
            documents = await response.json();
            renderDocuments();
        } else {
            documentsList.innerHTML = '<p class="no-events">Erreur lors du chargement des documents.</p>';
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        documentsList.innerHTML = '<p class="no-events">Erreur lors du chargement des documents.</p>';
    }
}

// Render calendar
function renderCalendar() {
    const calendarContainer = document.getElementById('calendar');
    if (!calendarContainer) return;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let month = currentMonth;
    let year = currentYear;
    
    function render() {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        
        const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        
        let html = `
            <div class="calendar-header">
                <button class="calendar-nav" onclick="previousMonth()">&larr;</button>
                <div class="calendar-month">${monthNames[month]} ${year}</div>
                <button class="calendar-nav" onclick="nextMonth()">&rarr;</button>
            </div>
            <div class="calendar-grid">
        `;
        
        // Day headers
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            html += '<div class="calendar-day other-month"></div>';
        }
        
        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];
            const hasEvent = events.some(event => {
                const eventDate = new Date(event.date);
                return eventDate.toISOString().split('T')[0] === dateStr;
            });
            const isSelected = currentSelectedDate && 
                currentSelectedDate.toISOString().split('T')[0] === dateStr;
            const isToday = date.toDateString() === new Date().toDateString();
            
            let classes = 'calendar-day';
            if (hasEvent) {
                classes += ' has-event';
            }
            if (isSelected) {
                classes += ' selected';
            }
            if (isToday && !isSelected) {
                classes += ' today';
            }
            
            html += `<div class="${classes}" onclick="selectDate(${year}, ${month}, ${day})">${day}</div>`;
        }
        
        html += '</div>';
        calendarContainer.innerHTML = html;
    }
    
    window.previousMonth = function() {
        month--;
        if (month < 0) {
            month = 11;
            year--;
        }
        render();
    };
    
    window.nextMonth = function() {
        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
        render();
    };
    
    window.selectDate = function(y, m, d) {
        currentSelectedDate = new Date(y, m, d);
        render();
        showEventsForDate(currentSelectedDate);
    };
    
    render();
}

// Show events for selected date
function showEventsForDate(date) {
    const eventsListTitle = document.getElementById('events-list-title');
    const eventsListContent = document.getElementById('events-list-content');
    
    if (!eventsListTitle || !eventsListContent) return;
    
    const dateStr = date.toISOString().split('T')[0];
    const dateEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.toISOString().split('T')[0] === dateStr;
    });
    
    if (dateEvents.length > 0) {
        eventsListTitle.textContent = `Événements du ${date.toLocaleDateString('fr-FR')}`;
        let html = '';
        dateEvents.forEach(event => {
            const typeLabels = {
                'meeting': 'Réunion',
                'holiday': 'Jour Férié',
                'training': 'Formation',
                'other': 'Autre'
            };
            html += `
                <div class="event-item">
                    <div class="event-header">
                        <h4 class="event-title">${escapeHtml(event.title)}</h4>
                        <span class="event-badge ${event.type}">${typeLabels[event.type] || event.type}</span>
                    </div>
                    <div class="event-location">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${escapeHtml(event.location || 'N/A')}</span>
                    </div>
                    ${isManagerOrAdmin ? `<button class="btn-delete-event" onclick="confirmDeleteEvent(${event.id}, '${escapeHtml(event.title)}')" style="margin-top: 8px; background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.875rem; font-weight: 500;">Supprimer</button>` : ''}
                </div>
            `;
        });
        eventsListContent.innerHTML = html;
    } else {
        eventsListTitle.textContent = 'Sélectionnez une date pour voir les événements';
        eventsListContent.innerHTML = '<p class="no-events">Aucun événement prévu pour cette date.</p>';
    }
}

// Render documents
function renderDocuments() {
    const documentsList = document.getElementById('documents-list');
    if (!documentsList) return;
    
    if (documents.length === 0) {
        documentsList.innerHTML = '<p class="no-events">Aucun document disponible.</p>';
        return;
    }
    
    const categoryLabels = {
        'Policy': 'Politique',
        'Benefits': 'Avantages',
        'Safety': 'Sécurité',
        'Training': 'Formation',
        'General': 'Général'
    };
    
    let html = '';
    documents.forEach(doc => {
        const uploadDate = new Date(doc.uploadDate + 'T00:00:00');
        html += `
            <div class="document-item">
                <div class="document-info">
                    <div class="document-icon">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="document-details">
                        <h3 class="document-title">${escapeHtml(doc.title)}</h3>
                        <div class="document-meta">
                            <span><i class="fas fa-calendar"></i> ${uploadDate.toLocaleDateString('fr-FR')}</span>
                            <span>•</span>
                            <span>${escapeHtml(doc.uploadedBy)}</span>
                            <span>•</span>
                            <span>${escapeHtml(doc.fileSize)}</span>
                            <span class="document-category">${categoryLabels[doc.category] || doc.category}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-download" onclick="downloadDocument(${doc.id})">
                        <i class="fas fa-download"></i>
                        Télécharger
                    </button>
                    ${isManagerOrAdmin ? `<button class="btn-delete-document" onclick="confirmDeleteDocument(${doc.id}, '${escapeHtml(doc.title)}')" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-size: 0.875rem; font-weight: 600;">Supprimer</button>` : ''}
                </div>
            </div>
        `;
    });
    documentsList.innerHTML = html;
}

// Download document
function downloadDocument(documentId) {
    window.location.href = `/api/documents/${documentId}/download`;
}

// Delete modal functions
function confirmDeleteEvent(eventId, eventTitle) {
    deleteType = 'event';
    deleteId = eventId;
    const modal = document.getElementById('deleteModal');
    const deleteMessage = document.getElementById('deleteMessage');
    
    if (modal && deleteMessage) {
        deleteMessage.textContent = `Voulez-vous vraiment supprimer l'événement "${eventTitle}" ?`;
        modal.style.display = 'flex';
    }
}

function confirmDeleteDocument(documentId, documentTitle) {
    deleteType = 'document';
    deleteId = documentId;
    const modal = document.getElementById('deleteModal');
    const deleteMessage = document.getElementById('deleteMessage');
    
    if (modal && deleteMessage) {
        deleteMessage.textContent = `Voulez-vous vraiment supprimer le document "${documentTitle}" ?`;
        modal.style.display = 'flex';
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'none';
        deleteType = null;
        deleteId = null;
    }
}

// Execute delete after confirmation
async function executeDelete() {
    if (!deleteType || !deleteId) return;
    
    try {
        const endpoint = deleteType === 'event' 
            ? `/api/events/${deleteId}`
            : `/api/documents/${deleteId}`;
            
        const response = await fetch(endpoint, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            closeDeleteModal();
            if (deleteType === 'event') {
                // Remove from events array immediately
                events = events.filter(e => e.id !== deleteId);
                renderCalendar();
                if (currentSelectedDate) {
                    showEventsForDate(currentSelectedDate);
                }
            } else {
                loadDocuments();
            }
        } else {
            alert('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Error deleting:', error);
        alert('Erreur lors de la suppression');
    }
}

// Delete document (old function - kept for compatibility but not used)
async function deleteDocument(documentId) {
    // This is now handled by confirmDeleteDocument
}

// Event Modal Functions
function openAddEventModal() {
    const modal = document.getElementById('addEventModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeAddEventModal() {
    const modal = document.getElementById('addEventModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('addEventForm').reset();
    }
}

// Document Modal Functions
function openUploadDocumentModal() {
    const modal = document.getElementById('uploadDocumentModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeUploadDocumentModal() {
    const modal = document.getElementById('uploadDocumentModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('uploadDocumentForm').reset();
    }
}

// Setup event form
function setupEventForm() {
    const form = document.getElementById('addEventForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            title: document.getElementById('event-title').value,
            date: document.getElementById('event-date').value,
            location: document.getElementById('event-location').value || null,
            type: document.getElementById('event-type').value
        };
        
        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                closeAddEventModal();
                await loadEvents();
                renderCalendar();
            } else {
                const error = await response.json();
                alert(error.error || 'Erreur lors de la création de l\'événement');
            }
        } catch (error) {
            console.error('Error creating event:', error);
            alert('Erreur lors de la création de l\'événement');
        }
    });
}

// Setup document form
function setupDocumentForm() {
    const form = document.getElementById('uploadDocumentForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const fileInput = document.getElementById('document-file');
        const file = fileInput.files[0];
        
        if (!file) {
            alert('Veuillez sélectionner un fichier PDF');
            return;
        }
        
        // Validate file type client-side
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Seuls les fichiers PDF sont autorisés');
            return;
        }
        
        // Validate file size client-side (10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('La taille du fichier dépasse la limite de 10 Mo');
            return;
        }
        
        const formData = new FormData();
        formData.append('title', document.getElementById('document-title').value);
        formData.append('category', document.getElementById('document-category').value || 'General');
        formData.append('file', file);
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Téléchargement...';
        
        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                closeUploadDocumentModal();
                await loadDocuments();
                alert('Document téléchargé avec succès!');
            } else {
                alert(data.error || 'Erreur lors du téléchargement du document');
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('Erreur lors du téléchargement du document: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Delete event (old function - kept for compatibility but not used)
async function deleteEvent(eventId) {
    // This is now handled by confirmDeleteEvent
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup delete confirmation button
document.addEventListener('DOMContentLoaded', function() {
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', executeDelete);
    }
});

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    const modals = ['addEventModal', 'uploadDocumentModal', 'deleteModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && event.target === modal) {
            if (modalId === 'deleteModal') {
                closeDeleteModal();
            } else if (modalId === 'addEventModal') {
                closeAddEventModal();
            } else if (modalId === 'uploadDocumentModal') {
                closeUploadDocumentModal();
            }
        }
    });
});

// Close modals with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAddEventModal();
        closeUploadDocumentModal();
        closeDeleteModal();
    }
});

