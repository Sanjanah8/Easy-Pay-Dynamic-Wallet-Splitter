from flask import Flask, render_template, request, jsonify
from datetime import datetime
import uuid

app = Flask(__name__, static_url_path='/static')


# In-memory database
db = {
    'groups': {},
    'members': {},
    'wallets': {},
    'transactions': [],
    'ledger': {}
}


def find_user_by_phone(phone):
    """Return member_id if phone number matches."""
    for member_id, member in db['members'].items():
        if member.get('phone') == phone:
            return member_id
    return None

def save_user(member_id, amount):
    """Add amount to the user's wallet."""
    wallet = db['wallets'][member_id]
    wallet['balance'] += amount
    wallet['total_contributed'] += amount
    
   
    transaction = {
        'id': str(uuid.uuid4())[:8],
        'member_id': member_id,
        'type': 'topup',
        'amount': amount,
        'description': 'SMS Top-up',
        'timestamp': datetime.now().isoformat()
    }
    db['transactions'].append(transaction)
    db['ledger'][member_id].append(transaction)

def send_sms(to, text):
    """Fake SMS sender for hackathon demo."""
    print(f"[SMS to {to}] {text}")

@app.route("/")
def intro():
    return render_template("intro.html")
@app.route("/home")

def home():
    return render_template("home.html")
@app.route('/api/groups', methods=['GET', 'POST'])
def handle_groups():
    if request.method == 'POST':
        data = request.json
        group_id = str(uuid.uuid4())[:8]
        db['groups'][group_id] = {
            'id': group_id,
            'name': data['name'],
            'description': data.get('description', ''),
            'created_at': datetime.now().isoformat(),
            'members': []
        }
        return jsonify({'success': True, 'group': db['groups'][group_id]})
    
    return jsonify({'groups': list(db['groups'].values())})

@app.route('/api/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    if group_id not in db['groups']:
        return jsonify({'success': False, 'error': 'Group not found'}), 404
    
    member_ids = db['groups'][group_id]['members']
    for member_id in member_ids:
        if member_id in db['members']:
            del db['members'][member_id]
        if member_id in db['wallets']:
            del db['wallets'][member_id]
        if member_id in db['ledger']:
            del db['ledger'][member_id]
    
    del db['groups'][group_id]
    
    return jsonify({'success': True, 'message': 'Group deleted successfully'})

@app.route('/api/groups/<group_id>/members', methods=['POST'])
def add_member(group_id):
    data = request.json
    member_id = str(uuid.uuid4())[:8]
    
    member = {
        'id': member_id,
        'group_id': group_id,
        'name': data['name'],
        'type': data['type'],  
        'phone': data.get('phone', ''),
        'members_count': data.get('members_count', 1)
    }
    
    db['members'][member_id] = member
    db['groups'][group_id]['members'].append(member_id)

    db['wallets'][member_id] = {
        'member_id': member_id,
        'balance': 0,
        'total_contributed': 0,
        'total_spent': 0
    }

    db['ledger'][member_id] = []
    
    return jsonify({'success': True, 'member': member})

@app.route('/api/wallet/<member_id>/topup', methods=['POST'])
def topup_wallet(member_id):
    data = request.json
    amount = float(data['amount'])
    
    db['wallets'][member_id]['balance'] += amount
    db['wallets'][member_id]['total_contributed'] += amount
  
    transaction = {
        'id': str(uuid.uuid4())[:8],
        'member_id': member_id,
        'type': 'topup',
        'amount': amount,
        'description': data.get('description', 'Wallet top-up'),
        'timestamp': datetime.now().isoformat()
    }
    
    db['transactions'].append(transaction)
    db['ledger'][member_id].append(transaction)
    
    return jsonify({
        'success': True, 
        'wallet': db['wallets'][member_id],
        'transaction': transaction
    })

@app.route('/api/groups/<group_id>/split', methods=['POST'])
def smart_split(group_id):
    data = request.json
    total_amount = float(data['amount'])
    description = data['description']
    split_type = data.get('split_type', 'equal')  
    
    group = db['groups'][group_id]
    member_ids = group['members']
    
    if not member_ids:
        return jsonify({'success': False, 'error': 'No members in group'})
    
    splits = {}
    
    if split_type == 'equal':
        per_person = total_amount / len(member_ids)
        for mid in member_ids:
            splits[mid] = per_person
    else:  
        total_count = sum(db['members'][mid]['members_count'] for mid in member_ids)
        for mid in member_ids:
            member_count = db['members'][mid]['members_count']
            splits[mid] = (member_count / total_count) * total_amount
    
    results = []
    failed = []
    
    for mid, amount in splits.items():
        if db['wallets'][mid]['balance'] >= amount:
            db['wallets'][mid]['balance'] -= amount
            db['wallets'][mid]['total_spent'] += amount
            
            transaction = {
                'id': str(uuid.uuid4())[:8],
                'member_id': mid,
                'type': 'expense',
                'amount': -amount,
                'description': description,
                'split_type': split_type,
                'timestamp': datetime.now().isoformat()
            }
            
            db['transactions'].append(transaction)
            db['ledger'][mid].append(transaction)
            results.append({
                'member': db['members'][mid]['name'],
                'amount': amount,
                'status': 'success'
            })
        else:
            failed.append({
                'member': db['members'][mid]['name'],
                'amount': amount,
                'balance': db['wallets'][mid]['balance'],
                'status': 'insufficient_funds'
            })
    
    return jsonify({
        'success': len(failed) == 0,
        'results': results,
        'failed': failed,
        'total_amount': total_amount
    })

@app.route('/api/groups/<group_id>/details')
def group_details(group_id):
    group = db['groups'].get(group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    
    members_data = []
    for mid in group['members']:
        member = db['members'][mid]
        wallet = db['wallets'][mid]
        ledger = db['ledger'][mid][-10:]  
        
        members_data.append({
            'member': member,
            'wallet': wallet,
            'recent_transactions': ledger
        })
    
    return jsonify({
        'group': group,
        'members': members_data
    })

@app.route('/api/ledger/<member_id>')
def get_ledger(member_id):
    return jsonify({
        'ledger': db['ledger'].get(member_id, []),
        'wallet': db['wallets'].get(member_id, {})
    })
             return "User not found", 404


wallets={}
@app.route("/sms_webhook", methods=["POST"])
def sms_webhook():
    sender = request.form.get("From")
    message = request.form.get("Body")

    print("\n=== SMS RECEIVED ===")
    print("From:", sender)
    print("Message:", message)

    response_text = ""
    balance = 0

    if message.upper().startswith("TOP"):
        try:
            added_amount = int(message.split()[1])

            # Find the member by phone
            member_id = find_user_by_phone(sender)
            if member_id:
                save_user(member_id, added_amount)
                balance = db['wallets'][member_id]['balance']
                response_text = f"Wallet topped up by ₹{added_amount} via SMS"
            else:
                response_text = "Phone not registered in any group."
        except:
            response_text = "Invalid format. Use: TOP <amount>"
    else:
        response_text = f"Message received: {message}"

    return {
        "sender": sender,
        "message": message,
        "response_text": response_text,
        "balance": balance
    }

@app.route("/get_wallet_balance")
def get_wallet_balance():
    sender = request.args.get("phone")  
    if sender in wallets:
        return str(wallets[sender])
    return "0"

if __name__ == '__main__':
    app.run(debug=True, port=5000)
