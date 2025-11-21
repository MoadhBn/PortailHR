// User dropdown toggle functionality
function toggleUserDropdown(event) {
    event.stopPropagation();
    const dropdownMenu = document.getElementById('userDropdownMenu');
    if (dropdownMenu) {
        dropdownMenu.classList.toggle('show');
    }
}

function closeUserDropdown() {
    const dropdownMenu = document.getElementById('userDropdownMenu');
    if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userDropdown = document.querySelector('.user-dropdown');
    const dropdownMenu = document.getElementById('userDropdownMenu');
    
    if (userDropdown && dropdownMenu && !userDropdown.contains(event.target)) {
        dropdownMenu.classList.remove('show');
    }
});

// Close dropdown on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeUserDropdown();
    }
});

// Handle sidebar hover to adjust main content margin
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar && mainContent) {
        // Handle sidebar hover
        sidebar.addEventListener('mouseenter', function() {
            mainContent.style.marginLeft = '280px';
            mainContent.style.width = 'calc(100% - 280px)';
        });
        
        sidebar.addEventListener('mouseleave', function() {
            mainContent.style.marginLeft = '64px';
            mainContent.style.width = 'calc(100% - 64px)';
        });
    }
});

