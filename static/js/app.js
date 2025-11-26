let currentGroupId = null;
let groups = [];
let members = [];
async function sendSMS() {
    const phone = document.getElementById("phone").value;
    const message = document.getElementById("message").value;

    if (!phone || !message) {
        alert("Enter both phone and message!");
        return;
    }

    const smsDiv = document.createElement("div");
    smsDiv.classList.add("sms-bubble");
    smsDiv.innerText = `Top-up successful: ₹${message}`;
    document.getElementById("smsDisplay").prepend(smsDiv);

    document.getElementById("message").value = "";
}

document.addEventListener('DOMContentLoaded', () => {
    loadGroups();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('createGroupForm').addEventListener('submit', handleCreateGroup);
    document.getElementById('addMemberForm').addEventListener('submit', handleAddMember);
    document.getElementById('topupForm').addEventListener('submit', handleTopup);
    document.getElementById('splitForm').addEventListener('submit', handleSplit);
    document.getElementById('memberType').addEventListener('change', handleMemberTypeChange);
    document.getElementById('memberSelect').addEventListener('change', handleMemberSelect);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function handleCreateGroup(e) {
    e.preventDefault();
    
    const name = document.getElementById('groupName').value;
    const description = document.getElementById('groupDesc').value;
    
    try {
        const response = await fetch('/api/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Group created successfully!', 'success');
            document.getElementById('createGroupForm').reset();
            loadGroups();
        }
    } catch (error) {
        showToast('Error creating group', 'error');
        console.error(error);
    }
}

async function deleteGroup(groupId, event) {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this group? All members, wallets, and transactions will be permanently deleted.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/groups/${groupId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Group deleted successfully!', 'success');
            
            if (currentGroupId === groupId) {
                currentGroupId = null;
                document.getElementById('memberCard').style.display = 'none';
                document.getElementById('walletCard').style.display = 'none';
                document.getElementById('splitCard').style.display = 'none';
                document.getElementById('detailsCard').style.display = 'none';
            }
            
            loadGroups();
        } else {
            showToast('Error deleting group', 'error');
        }
    } catch (error) {
        showToast('Error deleting group', 'error');
        console.error(error);
    }
}

async function loadGroups() {
    try {
        const response = await fetch('/api/groups');
        const data = await response.json();
        groups = data.groups;
        
        const groupsList = document.getElementById('groupsList');
        
        if (groups.length === 0) {
            groupsList.innerHTML = '<p class="empty-state">No groups yet. Create one to get started!</p>';
            return;
        }
        
        groupsList.innerHTML = groups.map(group => `
            <div class="group-item ${group.id === currentGroupId ? 'active' : ''}" onclick="selectGroup('${group.id}')">
                <button class="delete-btn" onclick="deleteGroup('${group.id}', event)" title="Delete group">
                    ✕
                </button>
                <h3>${group.name}</h3>
                <p>${group.description || 'No description'}</p>
                <div class="meta">
                    <span>👥 ${group.members.length} members</span>
                    <span>📅 ${new Date(group.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

function selectGroup(groupId) {
    currentGroupId = groupId;
    document.getElementById('selectedGroupId').value = groupId;
    

    document.getElementById('memberCard').style.display = 'block';
    document.getElementById('walletCard').style.display = 'block';
    document.getElementById('splitCard').style.display = 'block';
    document.getElementById('detailsCard').style.display = 'block';
    
    loadGroups();
    loadGroupDetails(groupId);
}

function handleMemberTypeChange(e) {
    const familySizeGroup = document.getElementById('familySizeGroup');
    const familySize = document.getElementById('familySize');
    
    if (e.target.value === 'family') {
        familySizeGroup.style.display = 'block';
        familySize.required = true;
    } else {
        familySizeGroup.style.display = 'none';
        familySize.required = false;
        
     
        if (e.target.value === 'couple') {
            familySize.value = 2;
        } else {
            familySize.value = 1;
        }
    }
}


async function handleAddMember(e) {
    e.preventDefault();
    
    const groupId = document.getElementById('selectedGroupId').value;
    const name = document.getElementById('memberName').value;
    const type = document.getElementById('memberType').value;
    const phone = document.getElementById('memberPhone').value;
    
    let membersCount = 1;
    if (type === 'couple') {
        membersCount = 2;
    } else if (type === 'family') {
        membersCount = parseInt(document.getElementById('familySize').value);
    }
    
    try {
        const response = await fetch(`/api/groups/${groupId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, phone, members_count: membersCount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Member added successfully!', 'success');
            document.getElementById('addMemberForm').reset();
            loadGroupDetails(groupId);
            updateMemberSelect();
        }
    } catch (error) {
        showToast('Error adding member', 'error');
        console.error(error);
    }
}


async function loadGroupDetails(groupId) {
    try {
        const response = await fetch(`/api/groups/${groupId}/details`);
        const data = await response.json();
        
        const membersList = document.getElementById('membersList');
        
        if (data.members.length === 0) {
            membersList.innerHTML = '<p class="empty-state">No members yet. Add some to get started!</p>';
            return;
        }
        
        membersList.innerHTML = data.members.map(m => {
            const member = m.member;
            const wallet = m.wallet;
            const transactions = m.recent_transactions;
            
            return `
                <div class="member-item">
                    <div class="member-header">
                        <div class="member-name">${member.name}</div>
                        <div class="member-type">${member.type}</div>
                    </div>
                    <div class="member-stats">
                        <div class="stat">
                            <div class="stat-label">Balance</div>
                            <div class="stat-value">₹${wallet.balance.toFixed(2)}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">Contributed</div>
                            <div class="stat-value">₹${wallet.total_contributed.toFixed(2)}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">Spent</div>
                            <div class="stat-value">₹${wallet.total_spent.toFixed(2)}</div>
                        </div>
                    </div>
                    ${transactions.length > 0 ? `
                        <div class="transactions">
                            <h4>Recent Transactions</h4>
                            ${transactions.slice(-5).reverse().map(t => `
                                <div class="transaction-item">
                                    <div>
                                        <div class="transaction-desc">${t.description}</div>
                                        <div class="transaction-time">${new Date(t.timestamp).toLocaleString()}</div>
                                    </div>
                                    <div class="transaction-amount ${t.amount > 0 ? 'positive' : 'negative'}">
                                        ${t.amount > 0 ? '+' : ''}₹${Math.abs(t.amount).toFixed(2)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        updateMemberSelect();
    } catch (error) {
        console.error('Error loading group details:', error);
    }
}

async function updateMemberSelect() {
    if (!currentGroupId) return;
    
    try {
        const response = await fetch(`/api/groups/${currentGroupId}/details`);
        const data = await response.json();
        
        const memberSelect = document.getElementById('memberSelect');
        memberSelect.innerHTML = '<option value="">Choose a member</option>' + 
            data.members.map(m => `
                <option value="${m.member.id}">${m.member.name}</option>
            `).join('');
    } catch (error) {
        console.error('Error updating member select:', error);
    }
}

async function handleMemberSelect(e) {
    const memberId = e.target.value;
    const walletInfo = document.getElementById('walletInfo');
    
    if (!memberId) {
        walletInfo.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/ledger/${memberId}`);
        const data = await response.json();
        
        document.getElementById('currentBalance').textContent = data.wallet.balance.toFixed(2);
        walletInfo.style.display = 'block';
    } catch (error) {
        console.error('Error loading wallet:', error);
    }
}

async function handleTopup(e) {
    e.preventDefault();
    
    const memberId = document.getElementById('memberSelect').value;
    const amount = parseFloat(document.getElementById('topupAmount').value);
    const description = document.getElementById('topupDesc').value || 'Wallet top-up';
    
    try {
        const response = await fetch(`/api/wallet/${memberId}/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, description })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Wallet topped up successfully!', 'success');
            document.getElementById('topupForm').reset();
            document.getElementById('currentBalance').textContent = data.wallet.balance.toFixed(2);
            loadGroupDetails(currentGroupId);
        }
    } catch (error) {
        showToast('Error topping up wallet', 'error');
        console.error(error);
    }
}

async function handleSplit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDesc').value;
    const splitType = document.getElementById('splitType').value;
    
    try {
        const response = await fetch(`/api/groups/${currentGroupId}/split`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, description, split_type: splitType })
        });
        
        const data = await response.json();
        
        const splitResults = document.getElementById('splitResults');
        
        if (data.success) {
            showToast('Expense split successfully!', 'success');
            document.getElementById('splitForm').reset();
            
            splitResults.innerHTML = `
                <h3 style="margin-bottom: 15px;">Split Complete - Total: ₹${data.total_amount.toFixed(2)}</h3>
                ${data.results.map(r => `
                    <div class="split-item success">
                        <div>
                            <strong>${r.member}</strong>
                            <div style="font-size: 0.9rem; color: var(--text-light);">Payment successful</div>
                        </div>
                        <div style="font-weight: 700; color: var(--success);">₹${r.amount.toFixed(2)}</div>
                    </div>
                `).join('')}
            `;
            
            loadGroupDetails(currentGroupId);
        } else {
            showToast('Some payments failed - insufficient funds', 'error');
            
            splitResults.innerHTML = `
                <h3 style="margin-bottom: 15px; color: var(--danger);">Split Failed</h3>
                ${data.results.map(r => `
                    <div class="split-item success">
                        <div>
                            <strong>${r.member}</strong>
                            <div style="font-size: 0.9rem; color: var(--text-light);">Payment successful</div>
                        </div>
                        <div style="font-weight: 700; color: var(--success);">₹${r.amount.toFixed(2)}</div>
                    </div>
                `).join('')}
                ${data.failed.map(f => `
                    <div class="split-item failed">
                        <div>
                            <strong>${f.member}</strong>
                            <div style="font-size: 0.9rem; color: var(--danger);">
                                Insufficient funds (Balance: ₹${f.balance.toFixed(2)})
                            </div>
                        </div>
                        <div style="font-weight: 700; color: var(--danger);">₹${f.amount.toFixed(2)}</div>
                    </div>
                `).join('')}
            `;
        }
    } catch (error) {
        showToast('Error splitting expense', 'error');
        console.error(error);
    }
}
