// Global state
let employees = [];
let allEmployeesFlat = [];
let selectedEmployee = null;
let isEditing = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadEmployees();
    // Only setup form if admin
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        setupForm();
    }
});

// Load employees from API
async function loadEmployees() {
    try {
        // Ensure the tree container exists
        const treeContainer = document.getElementById('organizationTree');
        if (!treeContainer) {
            // Retry after a short delay if container doesn't exist yet
            setTimeout(loadEmployees, 100);
            return;
        }
        
        const response = await fetch('/organigramme/data');
        const data = await response.json();
        employees = data.employees;
        updateFlatEmployees();
        renderTree();
        updateSuperiorSelect();
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

// Flatten employees for easier access
function updateFlatEmployees() {
    allEmployeesFlat = [];
    function flatten(empList) {
        empList.forEach(emp => {
            allEmployeesFlat.push(emp);
            if (emp.children && emp.children.length > 0) {
                flatten(emp.children);
            }
        });
    }
    flatten(employees);
}

// Render the organization tree
function renderTree() {
    const treeContainer = document.getElementById('organizationTree');
    if (!treeContainer) {
        console.error('Organization tree container not found');
        return;
    }
    
    if (employees.length === 0) {
        treeContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-building"></i>
                </div>
                <h3>Organigramme vide</h3>
                <p>Commencez à construire votre organigramme en ajoutant des employés via le formulaire à gauche.</p>
            </div>
        `;
        return;
    }

    treeContainer.innerHTML = '';
    const treeWrapper = document.createElement('div');
    treeWrapper.className = 'tree-wrapper';
    treeWrapper.style.minWidth = 'max-content';
    treeWrapper.style.display = 'flex';
    treeWrapper.style.flexDirection = 'column';
    treeWrapper.style.alignItems = 'center';
    treeWrapper.style.gap = '32px';

    employees.forEach(employee => {
        treeWrapper.appendChild(renderEmployeeNode(employee));
    });

    treeContainer.appendChild(treeWrapper);
}

// Render a single employee node
function renderEmployeeNode(employee) {
    const nodeContainer = document.createElement('div');
    nodeContainer.className = 'employee-node';

    const card = document.createElement('div');
    card.className = 'employee-card';
    card.onclick = () => openEmployeeModal(employee);

    const initials = getInitials(employee.name);

    card.innerHTML = `
        <div class="employee-card-header">
            <div class="employee-avatar">${initials}</div>
            <div class="employee-department">${employee.department || 'N/A'}</div>
        </div>
        <div class="employee-info">
            <h3>${employee.name}</h3>
            <p>${employee.position || 'N/A'}</p>
        </div>
        <div class="employee-details">
            <div class="employee-detail-item">
                <i class="fas fa-envelope"></i>
                <span>${employee.email}</span>
            </div>
            <div class="employee-detail-item">
                <i class="fas fa-phone"></i>
                <span>${employee.phone || 'N/A'}</span>
            </div>
        </div>
    `;

    nodeContainer.appendChild(card);

    // Render children if they exist
    if (employee.children && employee.children.length > 0) {
        const connection = document.createElement('div');
        connection.className = 'tree-connection';
        nodeContainer.appendChild(connection);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';

        employee.children.forEach((child, index) => {
            const childWrapper = document.createElement('div');
            childWrapper.className = 'child-node';
            childWrapper.appendChild(renderEmployeeNode(child));
            childrenContainer.appendChild(childWrapper);
        });

        nodeContainer.appendChild(childrenContainer);
    }

    return nodeContainer;
}

// Get initials from name
function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Setup form submission
function setupForm() {
    const form = document.getElementById('employeeForm');
    if (!form) return; // Form might not exist for non-admins
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            position: document.getElementById('position').value,
            department: document.getElementById('department').value,
            superiorId: document.getElementById('superior').value || null,
        };

        try {
            const response = await fetch('/organigramme/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                form.reset();
                await loadEmployees();
            } else {
                alert('Erreur lors de l\'ajout de l\'employé');
            }
        } catch (error) {
            console.error('Error adding employee:', error);
            alert('Erreur lors de l\'ajout de l\'employé');
        }
    });
}

// Update superior select dropdown
function updateSuperiorSelect() {
    const select = document.getElementById('superior');
    if (!select) return; // Select might not exist for non-admins
    
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Aucun (Direction)</option>';
    
    allEmployeesFlat.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} - ${emp.position}`;
        select.appendChild(option);
    });
    
    if (currentValue) {
        select.value = currentValue;
    }
}

// Open employee modal
function openEmployeeModal(employee) {
    selectedEmployee = employee;
    isEditing = false;
    
    const modal = document.getElementById('employeeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');

    modalTitle.textContent = 'Détails de l\'employé';
    
    const initials = getInitials(employee.name);
    
    modalBody.innerHTML = `
        <div class="employee-avatar-large">${initials}</div>
        <div class="detail-item">
            <label>Nom</label>
            <p>${employee.name}</p>
        </div>
        <div class="detail-item">
            <label>Email</label>
            <p class="detail-value">${employee.email}</p>
        </div>
        <div class="detail-item">
            <label>Téléphone</label>
            <p class="detail-value">${employee.phone || 'N/A'}</p>
        </div>
        <div class="detail-item">
            <label>Poste</label>
            <p class="detail-value">${employee.position || 'N/A'}</p>
        </div>
        <div class="detail-item">
            <label>Département</label>
            <p class="detail-value">${employee.department || 'N/A'}</p>
        </div>
    `;

    // Only show edit/delete buttons for admins
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        modalFooter.innerHTML = `
            <button class="btn-delete" onclick="deleteEmployee()">
                <i class="fas fa-trash"></i> Supprimer
            </button>
            <button class="btn-edit" onclick="editEmployee()">
                <i class="fas fa-edit"></i> Modifier
            </button>
        `;
    } else {
        modalFooter.innerHTML = '';
    }

    modal.style.display = 'flex';
}

// Close employee modal
function closeEmployeeModal() {
    const modal = document.getElementById('employeeModal');
    modal.style.display = 'none';
    selectedEmployee = null;
    isEditing = false;
}

// Edit employee
function editEmployee() {
    if (!selectedEmployee) return;
    
    isEditing = true;
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');

    modalTitle.textContent = 'Modifier l\'employé';

    // Get available employees for superior selection (excluding current and its children)
    const availableEmployees = allEmployeesFlat.filter(emp => 
        emp.id !== selectedEmployee.id && !isDescendant(selectedEmployee, emp.id)
    );

    let superiorOptions = '<option value="">Aucun (Direction)</option>';
    availableEmployees.forEach(emp => {
        const selected = selectedEmployee.superiorId === emp.id ? 'selected' : '';
        superiorOptions += `<option value="${emp.id}" ${selected}>${emp.name} - ${emp.position}</option>`;
    });

    // Use firstName and lastName directly from employee data (if available)
    // Fallback to parsing name if firstName/lastName are not available
    const editFirstName = selectedEmployee.firstName !== undefined 
        ? selectedEmployee.firstName 
        : (selectedEmployee.name.trim().split(' ').slice(0, -1).join(' ') || '');
    const editLastName = selectedEmployee.lastName !== undefined 
        ? selectedEmployee.lastName 
        : (selectedEmployee.name.trim().split(' ').slice(-1)[0] || '');

    modalBody.innerHTML = `
        <div class="form-group">
            <label for="edit-lastName">Nom</label>
            <input type="text" id="edit-lastName" value="${editLastName || ''}">
        </div>
        <div class="form-group">
            <label for="edit-firstName">Prénom</label>
            <input type="text" id="edit-firstName" value="${editFirstName || ''}">
        </div>
        <div class="form-group">
            <label for="edit-email">Email</label>
            <input type="email" id="edit-email" value="${selectedEmployee.email}">
        </div>
        <div class="form-group">
            <label for="edit-phone">Téléphone</label>
            <input type="tel" id="edit-phone" value="${selectedEmployee.phone || ''}">
        </div>
        <div class="form-group">
            <label for="edit-position">Poste</label>
            <input type="text" id="edit-position" value="${selectedEmployee.position || ''}">
        </div>
        <div class="form-group">
            <label for="edit-department">Département</label>
            <input type="text" id="edit-department" value="${selectedEmployee.department || ''}">
        </div>
        <div class="form-group">
            <label for="edit-superior">Supérieur hiérarchique</label>
            <select id="edit-superior">
                ${superiorOptions}
            </select>
        </div>
    `;

    modalFooter.innerHTML = `
        <button class="btn-cancel" onclick="cancelEdit()">
            <i class="fas fa-times"></i> Annuler
        </button>
        <button class="btn-save" onclick="saveEmployee()">
            <i class="fas fa-save"></i> Enregistrer
        </button>
    `;
}

// Check if an employee is a descendant
function isDescendant(employee, targetId) {
    if (!employee.children) return false;
    for (const child of employee.children) {
        if (child.id === targetId) return true;
        if (isDescendant(child, targetId)) return true;
    }
    return false;
}

// Cancel edit
function cancelEdit() {
    if (selectedEmployee) {
        openEmployeeModal(selectedEmployee);
    }
}

// Save employee
async function saveEmployee() {
    if (!selectedEmployee) return;

    const formData = {
        firstName: document.getElementById('edit-firstName').value,
        lastName: document.getElementById('edit-lastName').value,
        email: document.getElementById('edit-email').value,
        phone: document.getElementById('edit-phone').value,
        position: document.getElementById('edit-position').value,
        department: document.getElementById('edit-department').value,
        superiorId: document.getElementById('edit-superior').value || null,
    };

    try {
        const response = await fetch(`/organigramme/${selectedEmployee.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        });

        if (response.ok) {
            closeEmployeeModal();
            await loadEmployees();
        } else {
            alert('Erreur lors de la modification de l\'employé');
        }
    } catch (error) {
        console.error('Error updating employee:', error);
        alert('Erreur lors de la modification de l\'employé');
    }
}

// Delete employee
async function deleteEmployee() {
    if (!selectedEmployee) return;

    if (!confirm(`Voulez-vous vraiment supprimer ${selectedEmployee.name} ?`)) {
        return;
    }

    try {
        const response = await fetch(`/organigramme/${selectedEmployee.id}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            closeEmployeeModal();
            await loadEmployees();
        } else {
            alert('Erreur lors de la suppression de l\'employé');
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Erreur lors de la suppression de l\'employé');
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('employeeModal');
    if (event.target === modal) {
        closeEmployeeModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeEmployeeModal();
    }
});

