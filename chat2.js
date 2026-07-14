// --- CONFIGURATION ---
const CLOUDINARY_PRESET = "chat_upload"; 
const CLOUDINARY_CLOUD_NAME = "dmkriq5nw";
const CLOUDINARY_API_KEY = "677848692591661"; 

// --- STATE ---

let currentTranslateX = 0;
let isSwiping = false;
// --- STATE (Existing variables ke paas add karein) ---
let currentMediaList = []; // હાલની ચેટના બધા ફોટા/વિડિયો સ્ટોર થશે
let currentMediaIndex = -1; // અત્યારે કયો ફોટો ખુલ્લો છે તેનો નંબર
let swipeStartX = 0; // Swipe ક્યાંથી શરૂ થયું તે સ્ટોર કરવા
let swipeStartY = 0; // Vertical scroll રોકવા માટે

let firstChatOpen = true;
let selectedMsgIds = new Set(); // Store selected message IDs
let msgLongPressTimer = null;

// --- APP SETTINGS STATE ---
// --- SELECTION STATE ---
let selectedChatIds = new Set(); // 🔥 Changed to Set for multiple selection

let longPressTimer = null;
const LONG_PRESS_DURATION = 600; // ms
// Waveforms ko local memory mein store karne ke liye
let localWaveforms = JSON.parse(localStorage.getItem('chat_waveforms')) || {};

let appSettings = JSON.parse(localStorage.getItem('p2p_settings')) || {
    sound: true,
    dl_img: true,
    dl_video: true,
    dl_file: true
};

// Base64 Sounds (Short Pop & Ding)
const SOUND_SEND_DATA = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"; // Placeholder - Use logic below
// Real short sounds
const AUDIO_SRC_SEND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"; 
const AUDIO_SRC_RECV = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

let myId = localStorage.getItem('p2p_my_id');
let contacts = JSON.parse(localStorage.getItem('p2p_contacts') || "[]");
let currentChatId = null;
let myName = localStorage.getItem('p2p_my_name') || "User";
let myAvatar = localStorage.getItem('p2p_my_avatar') || "";

// Audio Recorder State
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;

// Track active listeners to avoid duplicates
let activeContactListeners = new Set(); 

// --- INITIALIZATION ---
function init() {
    if (!myId) {
        myId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        localStorage.setItem('p2p_my_id', myId);
    }
    
    // UI Init
       // Init Settings UI
    document.getElementById('set-sound').checked = appSettings.sound;
    document.getElementById('set-dl-img').checked = appSettings.dl_img;
    document.getElementById('set-dl-video').checked = appSettings.dl_video;
    document.getElementById('set-dl-file').checked = appSettings.dl_file;
    document.getElementById('my-id-display').innerText = formatId(myId);
    document.getElementById('settings-my-id').innerText = formatId(myId);
    document.getElementById('my-name-input').value = myName;
    document.getElementById('search-chat').addEventListener('input', (e) => {
        renderChatList(e.target.value.toLowerCase());
    });
    
    // Typing Listener (Input Field)
    const msgInput = document.getElementById('msg-input');
    msgInput.addEventListener('input', autoResizeTextarea);

function autoResizeTextarea() {
    const textarea = document.getElementById('msg-input');
    const expandBtn = document.getElementById('btn-expand-input');
    
    // Reset height to calculate correctly
    textarea.style.height = 'auto';
    
    // Max height constraint (approx 5 lines -> 24px per line * 5 = 120px)
    const maxHeight = 120; 
    
    if (textarea.scrollHeight > maxHeight) {
        textarea.style.height = maxHeight + 'px';
        textarea.style.overflowY = "auto";
        expandBtn.style.display = 'flex'; // Show expand button
    } else {
        textarea.style.height = textarea.scrollHeight + 'px';
        textarea.style.overflowY = "hidden";
        
        // Agar content 3-4 lines se zyada hai tabhi button dikhaye
        // Ya agar manual new lines hain
        const lineCount = textarea.value.split('\n').length;
        if (lineCount > 4 || textarea.scrollHeight > 100) {
            expandBtn.style.display = 'flex';
        } else {
            expandBtn.style.display = 'none';
        }
    }
    
    // Agar text khali hai to button hide karo
    if(textarea.value.trim() === "") {
         expandBtn.style.display = 'none';
    }
}


    msgInput.addEventListener('input', () => {
        handleTyping(); 
    });
    // Typing Listener (Input Field) ની નીચે આ ઉમેરો:
    
    // --- KEYBOARD HANDLING ---
    
    
    // જ્યારે કીબોર્ડ ખુલે
    msgInput.addEventListener('focus', () => {
        document.body.classList.add('keyboard-open');
        
        // જો અટેચમેન્ટ ડ્રોઅર ખુલ્લું હોય તો બંધ કરો
        closeAllPopups(); 
        
        // થોડી વાર પછી સ્ક્રોલ નીચે કરો જેથી ઇનપુટ છુપાઈ ન જાય
        setTimeout(scrollToBottom, 300);
    });

    // જ્યારે કીબોર્ડ બંધ થાય
    msgInput.addEventListener('blur', () => {
        // નાનો ડીલે જેથી તરત UI કુદે નહીં
        setTimeout(() => {
            document.body.classList.remove('keyboard-open');
        }, 100);
    });

        updateAvatarUI(myAvatar);

    // 🔥 FIX: Instant Load (Android Style)
    // Firebase ka wait mat karo, jo local data hai use turant dikhao
    renderChatList(); 

    // Wait for Firebase to load then start listeners
    const checkFb = setInterval(() => {

        if(window.db && window.fs) {
            clearInterval(checkFb);
            startGlobalListeners();
            registerUserOnFirestore(); 
            startPresenceSystem();     
        }
    }, 100);
}

// --- FIRESTORE LOGIC ---

async function registerUserOnFirestore() {
    try {
        const userRef = window.fs.doc(window.db, "users", myId);
        await window.fs.setDoc(userRef, {
            name: myName,
            avatar: myAvatar,
            lastSeen: window.fs.serverTimestamp(),
            online: true
        }, { merge: true });
    } catch(e) { console.log("User sync error:", e); }
}

function startGlobalListeners() {
    const q = window.fs.query(
        window.fs.collection(window.db, "messages"),
        window.fs.where("participants", "array-contains", myId),
        window.fs.orderBy("timestamp", "asc")
    );

    window.fs.onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const msg = change.doc.data();
                const msgId = change.doc.id;
                   // Play sound if it's NOT from me and it's a new message (approx logic)
                if (msg.receiver === myId && msg.status === 'sent') {
    let newStatus = 'delivered';
    
    // લોજિક: જો ચેટ ખુલ્લી છે (currentChatId) અને યુઝર મેસેજ જોઈ રહ્યો છે (Scroll Bottom)
    // તો સીધું 'read' કરો, નહીંતર ખાલી 'delivered'
    const container = document.getElementById('messages-container');
    if (
        currentChatId === msg.sender &&
        document.visibilityState === 'visible' &&
        isUserAtBottom(container)
    ) {
        newStatus = 'read';
    }
    
    window.fs.updateDoc(change.doc.ref, {
        status: newStatus,
        deliveredAt: window.fs.serverTimestamp(),
        readAt: newStatus === 'read' ? window.fs.serverTimestamp() : null
    });
}

                if (msg.sender !== myId) {
                    // Only play if message is very recent (avoid playing sound for loaded history)
                    if (Date.now() - msg.timestamp < 10000) {
                        playAppSound('receive');
                    }
                }
                if(shouldDeleteMessage(msg, change.doc.ref)) return;

                const otherId = msg.sender === myId ? msg.receiver : msg.sender;
                
                let contact = contacts.find(c => c.id === otherId);
                if (!contact) {
                    saveContact(otherId, "User " + otherId.slice(0,4));
                    contact = contacts.find(c => c.id === otherId);
                }

                if(!contact.history.find(h => h.id === msgId)) {
                    contact.history.push({
                        id: msgId,
                        content: msg.content,
                        type: msg.type,
                        timestamp: msg.timestamp,
                        side: msg.sender === myId ? 'sent' : 'received',
                        fileSize: msg.fileSize,
                        fileId: msgId,
                        status: msg.status,
                        readAt: msg.readAt
                    });
                    
                    if (msg.sender !== myId && currentChatId !== otherId) {
                        if(msg.status !== 'read') contact.unread = (contact.unread || 0) + 1;
                    }
                }
            }
            if (change.type === "modified") {
                const msg = change.doc.data();
                const otherId = msg.sender === myId ? msg.receiver : msg.sender;
                const contact = contacts.find(c => c.id === otherId);
                if(contact) {
                    const localMsg = contact.history.find(h => h.id === change.doc.id);
                    if(localMsg) {
                        localMsg.status = msg.status;
                        localMsg.readAt = msg.readAt;
                    }
                }
            }
        });
        
        saveContactsToStorage();
        startContactStatusListeners(); // Start listening for typing on contact list
        renderChatList();
        if(currentChatId) renderMessages(currentChatId);
    });
}

// --- NEW: LISTEN FOR TYPING IN CHAT LIST ---
function startContactStatusListeners() {
    contacts.forEach(contact => {
        // If we are already listening to this user, skip
        if(activeContactListeners.has(contact.id)) return;
        
        activeContactListeners.add(contact.id);
        
        window.fs.onSnapshot(
            window.fs.doc(window.db, "users", contact.id),
            (docSnap) => {
                if (!docSnap.exists()) return;

                const data = docSnap.data();

                // 🔥 NAME REALTIME UPDATE LOGIC
                // Firebase se jo naam aaya, use update karo
                if (data.name && contact.name !== data.name) {
                    contact.name = data.name; // Background me asli naam update karo
                }
                
                // Note: Render karte waqt hum (contact.nickname || contact.name) check karte hain.
                // Isliye agar nickname set hai, to UI par nickname hi dikhega, 
                // bhale hi background me 'contact.name' change ho gaya ho.

                // 🔥 AVATAR REALTIME UPDATE
                if (data.avatar && contact.avatar !== data.avatar) {
                    contact.avatar = data.avatar;
                }

                // Typing
                contact.isTyping = (data.typingTo === myId);

                saveContactsToStorage();
                renderChatList();

                // 🔥 If chat open, header also update
                if (currentChatId === contact.id) {
                    // Header title logic: Nickname > Real Name
                    const displayName = contact.nickname || contact.name;
                    document.getElementById('header-title').innerText = displayName;
                    
                    document.getElementById('header-avatar-display').innerHTML =
                        contact.avatar
                            ? `<img src="${contact.avatar}">`
                            : `<span class="material-icons-round">person</span>`;
                }
            }
        );
    });
}


function shouldDeleteMessage(msg, docRef) {
    if (msg.status === 'read' && msg.readAt) {
        const readTime = msg.readAt.toDate ? msg.readAt.toDate().getTime() : msg.readAt;
        const now = Date.now();
        const diffHours = (now - readTime) / (1000 * 60 * 60);
        
        if (diffHours >= 24) {
            window.fs.deleteDoc(docRef);
            return true; 
        }
    }
    return false;
}

// --- CLOUDINARY UPLOAD ---
async function uploadToCloudinary(file, type) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET); 

    try {
        const response = await fetch(url, { method: "POST", body: formData });
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);
        return data.secure_url; 
    } catch (err) {
        console.error("Upload failed", err);
        return null;
    }
}

// --- MESSAGING FLOW ---

async function sendMessage() {
    const input = document.getElementById('msg-input');
    const txt = input.value.trim();
    if (!txt || !currentChatId) return;
    // Inside sendMessage(), after textarea.value = '';
document.getElementById('msg-input').style.height = 'auto'; // Reset Height
document.getElementById('btn-expand-input').style.display = 'none'; // Hide Expand Button

    input.value = ''; 
    input.style.height = '40px'; // wapas 1 line
input.blur(); // soft reset feeling

    try {
        await window.fs.addDoc(window.fs.collection(window.db, "messages"), {
            content: txt,
            sender: myId,
            receiver: currentChatId,
            participants: [myId, currentChatId],
            timestamp: Date.now(),
            type: 'text',
            status: 'sent',
            deliveredAt: null,
            readAt: null
        });
        playAppSound('send');
        setTypingStatus(false);
        if(typingTimeout) clearTimeout(typingTimeout);
        
    } catch (e) { alert("Error sending: " + e.message); }
}

async function handleFileSelect(files) {
    if (files.length === 0 || !currentChatId) return;
    const file = files[0];
    
    let cloudType = 'raw';
    let msgType = 'file';
    if(file.type.startsWith('image/')) { cloudType = 'image'; msgType = 'image'; }
    else if(file.type.startsWith('video/')) { cloudType = 'video'; msgType = 'video'; }
    else if(file.type.startsWith('audio/')) { cloudType = 'video'; msgType = 'audio'; } 

    const cloudUrl = await uploadToCloudinary(file, cloudType);
    if(!cloudUrl) return;

    try {
        await window.fs.addDoc(window.fs.collection(window.db, "messages"), {
            content: cloudUrl, 
            fileName: file.name,
            fileSize: file.size,
            sender: myId,
            receiver: currentChatId,
            participants: [myId, currentChatId],
            timestamp: Date.now(),
            type: msgType,
            status: 'sent',
            deliveredAt: null,
            readAt: null
        });
    } catch (e) { console.error(e); }
}

// --- UI INTERACTIONS ---

function switchMainTab(tab) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    if (tab === 'chat-list') {
        document.getElementById('view-chat-list').classList.add('active');
        document.querySelector(`.nav-item[onclick="switchMainTab('chat-list')"]`).classList.add('active');
    } else {
        document.getElementById('view-status').classList.add('active');
        document.querySelector(`.nav-item[onclick="switchMainTab('status')"]`).classList.add('active');
    }
}

// app.js - શોધો અને આનાથી રિપ્લેસ કરો
async function openChat(id) {
    const contact = getContact(id);
    if(!contact) return;
    
    currentChatId = id;
    
    document.getElementById('view-chat-room').classList.add('active');
    document.getElementById('header-title').innerText = contact.nickname || contact.name || id;
    const headerAvatar = document.getElementById('header-avatar-display');

    // --- ફેરફાર અહીં છે ---
    // અહીં onclick="openMediaViewer(...)" કાઢી નાખ્યું છે
    // અને તેની જગ્યાએ onclick="closeChatRoom()" મૂક્યું છે.
    headerAvatar.innerHTML = contact.avatar ?
    `<img src="${contact.avatar}" style="cursor:pointer">` :
    `<span class="material-icons-round" style="color:#fff; cursor:pointer">person</span>`;

    const statusEl = document.getElementById('header-status');
    statusEl.innerText = "...";
    statusEl.style.color = "#ccc";

    setTimeout(() => {
    if (document.visibilityState === "visible" && isScrolledToBottom()) {
        markMessagesAsRead(id);
    }
}, 300);
    renderMessages(id);
    requestAnimationFrame(() => {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
});
    if (window.currentChatListener) {
        window.currentChatListener();
    }
    // બાકીનું લોજિક એમનું એમ જ રાખો...
    window.currentChatListener = window.fs.onSnapshot(window.fs.doc(window.db, "users", id), (doc) => {
        if(doc.exists()) {
            const data = doc.data();
            
            if (data.typingTo === myId) {
                statusEl.innerHTML = `
                    <span class="typing-wave" style="color: #fff; font-weight: 600;">
                        typing<span>.</span><span>.</span><span>.</span>
                    </span>`;
                return; 
            }

            let isOnline = false;
            let lastSeenText = "Offline";

            if (data.lastSeen) {
                const lastSeenTime = data.lastSeen.toMillis ? data.lastSeen.toMillis() : Date.now();
                const timeDiff = Date.now() - lastSeenTime;
                
                if (data.online && timeDiff < 120000) {
                    isOnline = true;
                } else {
                    const date = new Date(lastSeenTime);
                    const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const dateStr = date.toLocaleDateString([], {day:'numeric', month:'short'});
                    const isToday = new Date().toDateString() === date.toDateString();
                    lastSeenText = isToday ? `Last seen today at ${timeStr}` : `Last seen ${dateStr}`;
                }
            }

            if (isOnline) {
                statusEl.innerText = "Online";
                statusEl.style.color = "#ffffff";
                statusEl.style.fontWeight = "600";
            }
            else {
                statusEl.innerText = lastSeenText;
                statusEl.style.color = "rgba(255,255,255,0.7)"; 
                statusEl.style.fontWeight = "400";
            }
        } else {
            statusEl.innerText = "Offline";
        }
    });
}


// ✅ Replace this complete function in app.js
// ✅ Replace this function in app.js
async function markMessagesAsRead(chatPartnerId) {
    // 1. Safety Check: જો ચેટ ખુલ્લી ન હોય અથવા આ તે પાર્ટનર ન હોય, તો રોકો
    if (currentChatId !== chatPartnerId) return;

    // 2. Visibility Check: જો યુઝર એપની બહાર હોય અથવા સ્ક્રોલ ઉપર હોય તો Read ન કરો
    if (document.visibilityState !== 'visible' || !isScrolledToBottom()) return;

    // 3. લોકલ UI અપડેટ (Unread count 0 કરો)
    const contact = getContact(chatPartnerId);
    if(contact) {
        contact.unread = 0;
        saveContactsToStorage();
        renderChatList();
    }

    // 4. Firebase Query
    const q = window.fs.query(
        window.fs.collection(window.db, "messages"),
        window.fs.where("sender", "==", chatPartnerId),
        window.fs.where("receiver", "==", myId),
        window.fs.where("status", "in", ["sent", "delivered"]) 
    );

    // 🔥 FIX: onSnapshot ની જગ્યાએ getDocs વાપર્યું (One-time update)
    try {
        const snapshot = await window.fs.getDocs(q);
        snapshot.forEach(async (d) => {
            await window.fs.updateDoc(d.ref, {
                status: 'read',
                readAt: window.fs.serverTimestamp()
            });
        });
    } catch (e) { console.log("Read receipt error:", e); }
}


function closeChatRoom() {
    document.getElementById('view-chat-room').classList.remove('active');
    
    // Ensure popups are closed
    closeAllPopups(); 

    setTypingStatus(false);
    currentChatId = null;
    firstChatOpen = true; // 🔁 next chat open ke liye reset
    if (window.currentChatListener) {
        window.currentChatListener();
        window.currentChatListener = null;
    }
    
    renderChatList();
}

// app.js - શોધો અને આનાથી રિપ્લેસ કરો
function renderChatList(filterText = '') {
    const container = document.getElementById('chat-list-container');
    
    // 1. Sort Contacts
    const sortedContacts = [...contacts].sort((a,b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = a.history.length ? a.history[a.history.length-1].timestamp : 0;
        const timeB = b.history.length ? b.history[b.history.length-1].timestamp : 0;
        return timeB - timeA;
    });

    const filtered = sortedContacts.filter(c => 
        (c.nickname || c.name).toLowerCase().includes(filterText) || c.id.includes(filterText)
    );

    // Empty state check
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:20px; text-align:center; color:#999"><span class="material-icons-round" style="font-size:48px; color:#ddd">search_off</span><p>No chats found.</p></div>`;
        return;
    } else {
        // Remove empty state if present
        const es = container.querySelector('.empty-state');
        if (es) es.remove();
    }

    // 2. Diffing & Reordering Loop
    filtered.forEach((c, index) => {
        const itemId = `chat-item-${c.id}`;
        let div = document.getElementById(itemId);
        
        // Prepare Data
        const displayName = c.nickname || c.name;
        const lastMsg = c.history.length > 0 ? c.history[c.history.length - 1] : null;
        let prevText = 'Tap to start chatting';
        let timeDisplay = '';
        let statusIcon = '';
        
        // --- Content Logic ---
        if (c.isTyping) {
            prevText = `<span style="color: #4F75FE; font-weight: 600;">typing...</span>`;
            if(lastMsg) timeDisplay = formatTime(lastMsg.timestamp); // Keep time of last msg
        }
        else if (lastMsg) {
            // Status Icon for Last Msg (Sent by me)
            if (lastMsg.side === 'sent') {
    if (lastMsg.status === 'read') {
        statusIcon = `<span class="material-icons-round" style="font-size:14px; color:#4af; margin-right:3px; vertical-align:middle;">done_all</span>`;
    } else if (lastMsg.status === 'delivered') {
        statusIcon = `<span class="material-icons-round" style="font-size:14px; color:#888; margin-right:3px; vertical-align:middle;">done_all</span>`;
    } else {
        statusIcon = `<span class="material-icons-round" style="font-size:14px; color:#888; margin-right:3px; vertical-align:middle;">done</span>`;
    }
}

            if (lastMsg.type === 'text') prevText = statusIcon + lastMsg.content;
            else if (lastMsg.type === 'audio') prevText = statusIcon + '<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><span class="material-icons-round" style="font-size:16px; color: var(--primary);">mic</span> Voice message</span>';
            else if (lastMsg.type === 'image') prevText = statusIcon + '<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><span class="material-icons-round" style="font-size:16px; color: var(--primary);">image</span> Photo</span>';
            else if (lastMsg.type === 'video') prevText = statusIcon + '<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><span class="material-icons-round" style="font-size:16px; color: var(--primary);">videocam</span> Video</span>';
            else prevText = statusIcon + `<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle"><span class="material-icons-round" style="font-size:16px; color: var(--primary);">description</span> File</span>`;
            
            const d = new Date(lastMsg.timestamp);
            const now = new Date();
            timeDisplay = (d.toDateString() === now.toDateString()) 
    ? d.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit', hour12: true})
    : d.toLocaleDateString([], {day:'numeric', month:'short'});

        }

        // --- Create or Update ---
        if (!div) {
            div = document.createElement('div');
            div.id = itemId;
            div.className = 'chat-item';
            
            // Initial HTML Structure
            div.innerHTML = `
                <div class="avatar-container"></div>
                <div class="chat-info">
                    <div class="chat-name-row">
                        <h3 class="chat-name"></h3> 
                        <div class="meta-right" style="display:flex; align-items:center; gap:5px;">
                            <span class="pin-wrapper"></span>
                            <span class="chat-time"></span>
                        </div>
                    </div>
                    <div class="chat-msg-row">
                        <div class="chat-preview"></div>
                        <div class="badge-wrapper"></div>
                    </div>
                </div>`;
            
            // Events
            attachChatListEvents(div, c);
            container.appendChild(div);
        }

        // --- Apply Selection State ---
        const isSelected = selectedChatIds.has(c.id);
        if (isSelected) div.classList.add('selected-row');
        else div.classList.remove('selected-row');

        // --- Intelligent Content Update (Prevent Flickr) ---
        // We select specific elements and update text only if changed
        
        // 1. Avatar
        const avatarContainer = div.querySelector('.avatar-container');
        const currentAvatarSrc = avatarContainer.querySelector('img')?.src;
        // If avatar changed or doesn't exist
        if (c.avatar && currentAvatarSrc !== c.avatar) {
             avatarContainer.innerHTML = `<img src="${c.avatar}" class="avatar clickable-avatar" onclick="event.stopPropagation(); openMediaViewer('${c.avatar}', 'image', '${displayName}')">`;
        } else if (!c.avatar && !avatarContainer.innerText.includes(displayName.charAt(0))) {
             avatarContainer.innerHTML = `<div class="avatar">${displayName.charAt(0)}</div>`;
        }

        // 2. Name
        const nameEl = div.querySelector('.chat-name');
        if (nameEl.innerText !== displayName) nameEl.innerText = displayName;

        // 3. Time
        const timeEl = div.querySelector('.chat-time');
        if (timeEl.innerText !== timeDisplay) timeEl.innerText = timeDisplay;

        // 4. Preview (Use innerHTML because of Icons)
        const prevEl = div.querySelector('.chat-preview');
        // Simple hash check using length/content to avoid constant parsing
        if (prevEl.innerHTML !== prevText) prevEl.innerHTML = prevText;

        // 5. Unread Badge
        const badgeWrapper = div.querySelector('.badge-wrapper');
        const badgeHtml = c.unread > 0 ? `<div class="unread-badge">${c.unread}</div>` : '';
        if (badgeWrapper.innerHTML !== badgeHtml) badgeWrapper.innerHTML = badgeHtml;

        // 6. Pin Icon
        const pinWrapper = div.querySelector('.pin-wrapper');
        const pinHtml = c.isPinned ? `<span class="material-icons-round pinned-icon">push_pin</span>` : '';
        if (pinWrapper.innerHTML !== pinHtml) pinWrapper.innerHTML = pinHtml;

        // 7. Re-order in DOM (Important!)
        // If the current element at 'index' is not this div, move this div to 'index'.
        const currentChildAtIndex = container.children[index];
        if (currentChildAtIndex !== div) {
            container.insertBefore(div, currentChildAtIndex);
        }
    });

    // 3. Remove Obsolete Items (Chats filtered out or deleted)
    const validIds = new Set(filtered.map(c => `chat-item-${c.id}`));
    Array.from(container.children).forEach(child => {
        if (child.id.startsWith('chat-item-') && !validIds.has(child.id)) {
            child.remove();
        }
    });
}

function attachChatListEvents(div, c) {
    let longPressTimer;
    
    const startPress = (e) => {
        if (e.type === 'touchstart') { /* passive */ } 
        longPressTimer = setTimeout(() => {
            selectChat(c.id);
        }, LONG_PRESS_DURATION);
    };

    const cancelPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    div.addEventListener('touchstart', startPress, {passive: true});
    div.addEventListener('touchend', cancelPress);
    div.addEventListener('touchmove', cancelPress);
    div.addEventListener('mousedown', startPress);
    div.addEventListener('mouseup', cancelPress);
    div.addEventListener('mouseleave', cancelPress);

    div.onclick = (e) => {
        // Prevent click if avatar was clicked (handled in innerHTML)
        if(e.target.classList.contains('clickable-avatar')) return;
        
        if (selectedChatIds.size > 0) {
            selectChat(c.id);
        } else {
            openChat(c.id);
        }
    };
}




// Global Observer Variable (Isse function ke bahar rakhein)
let dateObserver = null;

function renderMessages(id) {
    const container = document.getElementById('messages-container');
    const contact = getContact(id);
    if (!contact) return;

    // 1. Sort messages
    const msgs = contact.history.sort((a, b) => a.timestamp - b.timestamp);

    // 2. Setup Floating Header (Only once)
    let floatingPill = document.getElementById('floating-date-pill');
    if (!floatingPill) {
        floatingPill = document.createElement('div');
        floatingPill.id = 'floating-date-pill';
        // Add to Chat View, not container (so it stays fixed)
        document.getElementById('view-chat-room').appendChild(floatingPill); 
    }
    // Default hidden
    floatingPill.style.opacity = '0'; 

    // 3. Track Processed Messages to handle deletions later
    const processedRowIds = new Set();
    const processedSepIds = new Set();
    
    let lastDateLabel = null;

    // 4. Rendering Loop
    msgs.forEach((msg, index) => {
        const currentDateLabel = getDateLabel(msg.timestamp);
        
        // --- A. Handle Date Separator (Unique ID Logic) ---
        // Clean label for ID (remove spaces/slashes)
        const safeLabelId = currentDateLabel.replace(/[^a-zA-Z0-9]/g, '-'); 
        const sepId = `date-sep-${safeLabelId}`;
        
        // Logic: Agar date change hui hai, ya yeh first message hai
        if (currentDateLabel !== lastDateLabel) {
            let sepDiv = document.getElementById(sepId);
            
            if (!sepDiv) {
                sepDiv = document.createElement('div');
                sepDiv.id = sepId; // 🔥 Unique ID rokti hai duplicates ko
                sepDiv.className = 'date-separator-container';
                sepDiv.setAttribute('data-label', currentDateLabel);
                sepDiv.innerHTML = `<span class="date-pill">${currentDateLabel}</span>`;
                container.appendChild(sepDiv);
            }
            
            // Re-order Logic: Ensure separator is before the current message
            // (Agar DOM mein galat jagah hai to move kar dega)
            const currentRow = document.getElementById(`row-${msg.id}`);
            if (currentRow && container.contains(currentRow)) {
                container.insertBefore(sepDiv, currentRow);
            } else {
                 container.appendChild(sepDiv);
            }

            processedSepIds.add(sepId);
            lastDateLabel = currentDateLabel;
        }

        // --- B. Handle Message Row ---
        let rowDiv = document.getElementById(`row-${msg.id}`);
        const isNew = !rowDiv;

        if (isNew) {
    // Create Row
    rowDiv = document.createElement('div');
    rowDiv.className = `msg-row ${msg.side}`;
    rowDiv.id = `row-${msg.id}`;
    if (selectedMsgIds.has(msg.id)) rowDiv.classList.add('msg-selected');

    // Create Bubble
    const div = document.createElement('div');
    div.id = `msg-${msg.id}`;
    renderBubbleContent(div, msg, currentDateLabel);
    
    // 🔥 જૂની લાઈન હટાવી દો: attachMessageEvents(div, msg);

    rowDiv.appendChild(div);
    container.appendChild(rowDiv);

    // 🔥 નવી લાઈન: હવે ઇવેન્ટ આખી રો પર લાગશે
    attachMessageEvents(rowDiv, msg); 

            // Scroll for new message
            if (msg.side === 'sent' || isUserAtBottom(container)) {
                setTimeout(scrollToBottomSmooth, 50);
            }
        } else {
            // Update Logic (Status/Edit)
            const bubble = rowDiv.querySelector('.bubble');
            if(bubble) {
                // Update Date Group data if changed (rare)
                bubble.setAttribute('data-date-group', currentDateLabel);
                
                // Status Update
                const currentStatus = bubble.getAttribute('data-status');
                if (msg.side === 'sent' && currentStatus !== msg.status) {
                    updateBubbleMeta(bubble, msg);
                }
                // Edit Update
                if (msg.isEdited && bubble.getAttribute('data-edited') !== 'true') {
                    renderBubbleContent(bubble, msg, currentDateLabel);
                }
            }
        }
        processedRowIds.add(`row-${msg.id}`);
    });

    // 5. Cleanup (Delete old messages & separators)
    // Remove deleted messages
    Array.from(container.querySelectorAll('.msg-row')).forEach(row => {
        if (!processedRowIds.has(row.id)) row.remove();
    });
    // Remove unused separators (e.g. if all messages of "Yesterday" deleted)
    Array.from(container.querySelectorAll('.date-separator-container')).forEach(sep => {
        if (!processedSepIds.has(sep.id)) sep.remove();
    });

    // 6. Scroll Listener
    container.onscroll = handleContainerScroll;
    
    if (firstChatOpen) {
        requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
        firstChatOpen = false;
    }
}


// --- Helper: Render Bubble Content (Moved out for cleaner code) ---
function renderBubbleContent(div, msg, dateLabel) {
    let metaClass = '';
    if (dateLabel === 'Today' || dateLabel === 'Yesterday') {
        metaClass = ' force-show-meta';
    }
    
    // Check selection
    const isSel = selectedMsgIds.has(msg.id);
    const selClass = isSel ? ' selected-msg' : '';

    div.className = `bubble ${msg.side}${metaClass}${selClass}`;
    div.setAttribute('data-date-group', dateLabel);
    div.setAttribute('data-status', msg.status);
    div.setAttribute('data-edited', msg.isEdited ? 'true' : 'false');
    // Store content length/hash to detect changes easily
    div.setAttribute('data-content-hash', msg.content.length); 

    // Time & Edited HTML
    let editedHtml = msg.isEdited ? `<span class="edited-label">edited</span>` : '';
    // 🔥 Status Icon Logic (Sent / Delivered / Read)
let statusIcon = '';
if (msg.side === 'sent') {
    if (msg.status === 'read') {
        statusIcon = '<span class="material-icons-round" style="font-size:12px; margin-left:4px; color:#4af;">done_all</span>';
    } else if (msg.status === 'delivered') {
        statusIcon = '<span class="material-icons-round" style="font-size:12px; margin-left:4px; color:#ccc;">done_all</span>';
    } else {
        statusIcon = '<span class="material-icons-round" style="font-size:12px; margin-left:4px; color:#ccc;">done</span>';
    }
}

    const timeHtml = `<div class="bubble-meta">${editedHtml}${formatTime(msg.timestamp)} ${statusIcon}</div>`;

    let contentHtml = '';

    if (msg.type === 'text') {
        const formattedContent = parseAndFormatMessage(msg.content);
        const charLimit = 200; 
        
        if (msg.content.length > charLimit) {
            contentHtml = `
                <div id="text-content-${msg.id}" class="msg-text-content collapsed"><span>${formattedContent}</span></div>
                <span id="btn-more-${msg.id}" class="read-toggle-btn" onclick="toggleReadMore('${msg.id}', event)">More...</span>
                <span id="btn-less-${msg.id}" class="read-toggle-btn" onclick="toggleReadMore('${msg.id}', event)" style="display:none;">Less</span>
                ${timeHtml}`;
        } else {
            contentHtml = `<span class="msg-text-content">${formattedContent}</span>` + timeHtml;
        }
    } 
    else if (msg.type === 'image') {
        contentHtml = `<img src="${msg.content}" loading="lazy" onclick="if(selectedMsgIds.size===0) openMediaViewer('${msg.content}', 'image', '${msg.fileName || 'Image'}')" style="max-width:100%; border-radius:12px; margin-bottom:5px; cursor:pointer;">` + timeHtml;
    } 
    else if (msg.type === 'audio') {
        const barsData = getPersistentWaveform(msg.id);
        let barsHtml = barsData.map((h, i) => `<div class="wave-bar" style="height:${h}%" data-index="${i}"></div>`).join('');
        const audioId = `audio-${msg.id}`;
        contentHtml = `<div class="audio-player-container" id="container-${audioId}"><div class="audio-top-row"><div class="audio-control-btn" id="btn-${audioId}" onclick="if(selectedMsgIds.size===0) playAudioMsg('${msg.content}', '${audioId}')"><span class="material-icons-round">play_arrow</span></div><div class="audio-track" id="track-${audioId}">${barsHtml}</div></div><div class="audio-timings"><span id="cur-${audioId}">0:00</span><span id="rem-${audioId}">-0:00</span></div></div>` + timeHtml;
    } 
    else if (msg.type === 'video') {
         contentHtml = `<div style="position:relative; cursor:pointer; display: flex; align-items: center; justify-content: center; line-height: 0; border-radius: 12px; overflow: hidden;" onclick="if(selectedMsgIds.size===0) openMediaViewer('${msg.content}', 'video', '${msg.fileName}')"><video src="${msg.content}" style="width:100%; height:auto; display:block; border-radius:12px;"></video><div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(0,0,0,0.5); border-radius:50%; padding:10px; display:flex; align-items:center; justify-content:center;"><span class="material-icons-round" style="color:white; font-size:30px;">play_arrow</span></div></div>` + timeHtml;
    } 
        // ... ઉપરનો કોડ text, image, video માટે એમને એમ રાખો ...

    else {
        // 🔥 UPDATED FILE CARD UI
        // અહી આપણે URL પણ પાસ કરીએ છીએ જેથી નામ ન હોય તો ત્યાંથી મળે
        const meta = getFileMetaInfo(msg.fileName, msg.content);
        const sizeDisplay = formatBytes(msg.fileSize);
        const displaySize = sizeDisplay ? `${sizeDisplay} • ${meta.typeName}` : meta.typeName;

        contentHtml = `
        <div class="file-bubble-container" onclick="if(selectedMsgIds.size===0) openFileSheet('${msg.content}', '${meta.cleanName}', ${msg.fileSize || 0})">
            <div class="file-icon-sq ${meta.colorClass}">
                <span class="material-icons-round">${meta.icon}</span>
            </div>
            <div class="file-info-col">
                <span class="f-name">${meta.cleanName}</span>
                <span class="f-size">${displaySize}</span>
            </div>
        </div>` + timeHtml;
    }

    div.innerHTML = contentHtml;
}


// --- Helper: Attach Events (Separated to avoid closures in loop) ---
/* --- app.js --- */

// --- Helper: Attach Events (Updated for Row Selection) ---
function attachMessageEvents(row, msg) {
    let msgLongPressTimer = null;
    
    const startMsgPress = (e) => {
        // લોંગ પ્રેસ શરૂ કરો (રો પર ગમે ત્યાં)
        if (selectedMsgIds.size > 0) return; 
        msgLongPressTimer = setTimeout(() => selectMessage(msg.id), 600);
    };

    const cancelMsgPress = () => {
        if (msgLongPressTimer) {
            clearTimeout(msgLongPressTimer);
            msgLongPressTimer = null;
        }
    };

    // ઇવેન્ટ હવે Row (row) પર લાગશે
    row.addEventListener('touchstart', startMsgPress, {passive: true});
    row.addEventListener('touchend', cancelMsgPress);
    row.addEventListener('touchmove', cancelMsgPress);
    row.addEventListener('mousedown', startMsgPress);
    row.addEventListener('mouseup', cancelMsgPress);
    row.addEventListener('mouseleave', cancelMsgPress);

    // ... inside attachMessageEvents function ...

    row.onclick = (e) => {
        // લિંક ક્લિક હોય તો રોકો
        if(e.target.tagName === 'A') return;
        
        // જો સિલેક્શન મોડ ચાલુ હોય, તો રો પર ક્લિક કરવાથી પણ સિલેક્ટ થશે
        if (selectedMsgIds.size > 0) {
            selectMessage(msg.id);
        } 
        else {
            // 🔥 REMOVED: The logic that toggles visibility on click
            // Since CSS now makes it always visible, we don't need to do anything here.
            
            /* const bubble = row.querySelector('.bubble');
            if (bubble && bubble.contains(e.target)) {
                if (!e.target.closest('.download-btn') && !e.target.closest('.audio-control-btn') && !e.target.closest('img') && !e.target.closest('video') && !e.target.closest('.file-bubble-container')) {
                     bubble.classList.toggle('show-details'); // <--- THIS LINE REMOVED
                }
            } 
            */
        }
    };

}

// --- Helper: Update Meta Only (Fast) ---
// app.js -> updateBubbleMeta function

function updateBubbleMeta(bubble, msg) {
    bubble.setAttribute('data-status', msg.status);
    const metaDiv = bubble.querySelector('.bubble-meta');
    if (metaDiv) {
        let editedHtml = msg.isEdited ? `<span class="edited-label">edited</span>` : '';
        
        // 🔥 NEW ICON LOGIC HERE TOO
        let statusIcon = '';
        if (msg.status === 'read') {
            statusIcon = '<span class="material-icons-round" style="font-size:14px; margin-left:4px; color:#4af;">done_all</span>';
        } else if (msg.status === 'delivered') {
            statusIcon = '<span class="material-icons-round" style="font-size:14px; margin-left:4px; color:#ccc;">done_all</span>';
        } else {
            statusIcon = '<span class="material-icons-round" style="font-size:14px; margin-left:4px; color:#ccc;">done</span>';
        }

        metaDiv.innerHTML = `${editedHtml}${formatTime(msg.timestamp)} ${statusIcon}`;
    }
}

// --- Helper: Scroll Check ---
function isUserAtBottom(container) {
    return container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
}

// --- FIXED SCROLL HANDLER (NO FLICKERING) ---
// Function ke bahar ek variable banayein (Global scope mein)
let scrollStopTimer = null; 

function handleContainerScroll() {
    const container = document.getElementById('messages-container');
    const header = document.querySelector('.chat-header');
    const scrollBtn = document.getElementById('btn-scroll-bottom');
    const floatingPill = document.getElementById('floating-date-pill');
    
    if (!header || !container || !floatingPill) return;
    
    // 1. Scroll Button Logic (Same as before)
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 300) scrollBtn.classList.add('show');
    else scrollBtn.classList.remove('show');

    // 🔥 2. Clear Timer on Scroll (Agar user scroll kar raha hai to timer reset karo)
    if (scrollStopTimer) {
        clearTimeout(scrollStopTimer);
    }

    // 3. Find Visible Date
    const headerBottom = header.getBoundingClientRect().bottom;
    const children = Array.from(container.children);
    let targetDateLabel = '';

    // Screen par pehla element dhundho
    for (let child of children) {
        const rect = child.getBoundingClientRect();
        if (rect.bottom > headerBottom + 20) { 
            if (child.classList.contains('date-separator-container')) {
                targetDateLabel = child.getAttribute('data-label');
            } else if (child.classList.contains('msg-row')) {
                const bubble = child.querySelector('.bubble');
                if (bubble) targetDateLabel = bubble.getAttribute('data-date-group');
            }
            break;
        }
    }

    // 4. Show/Hide Logic with Auto-Hide Timer
    if (targetDateLabel) {
        floatingPill.innerText = targetDateLabel;
        
        // Check Static Separator overlap
        const safeLabelId = targetDateLabel.replace(/[^a-zA-Z0-9]/g, '-');
        const staticSep = document.getElementById(`date-sep-${safeLabelId}`);
        
        let shouldShow = true;
        
        if (staticSep) {
            const sepRect = staticSep.getBoundingClientRect();
            // Agar static header visible area mein hai to floating mat dikhao
            if (sepRect.top > headerBottom && sepRect.top < headerBottom + 50) {
                 shouldShow = false;
            }
        }

        if (shouldShow) {
            // ✅ Show Pill (Jab scroll ho raha ho)
            floatingPill.style.opacity = '1';
            floatingPill.style.transform = 'translateX(-50%) translateY(0)';

            // 🔥 Hide after 1 second of inactivity (Jab scroll ruk jaye)
            scrollStopTimer = setTimeout(() => {
                floatingPill.style.opacity = '0';
                floatingPill.style.transform = 'translateX(-50%) translateY(-10px)';
            }, 1000); // 1000ms = 1 second

        } else {
            // Hide immediately (Agar static header dikh raha hai)
            floatingPill.style.opacity = '0';
            floatingPill.style.transform = 'translateX(-50%) translateY(-10px)';
        }

    } else {
        floatingPill.style.opacity = '0';
    }
}

// --- UTILS & HELPERS ---

function playAudio(btn, url) {
    const audio = new Audio(url);
    audio.play();
    btn.innerHTML = '<span class="material-icons-round">pause</span>';
    audio.onended = () => btn.innerHTML = '<span class="material-icons-round">play_arrow</span>';
}
function preloadNextMedia() {
    if (!currentMediaList || currentMediaList.length === 0) return;
    
    // Preload Next Image
    const nextIndex = currentMediaIndex + 1;
    if (nextIndex < currentMediaList.length) {
        const item = currentMediaList[nextIndex];
        if (item.type === 'image') {
            const img = new Image();
            img.src = item.content;
        }
    }
    
    // Preload Previous Image
    const prevIndex = currentMediaIndex - 1;
    if (prevIndex >= 0) {
        const item = currentMediaList[prevIndex];
        if (item.type === 'image') {
            const img = new Image();
            img.src = item.content;
        }
    }
}
function saveContact(id, name) {
    if (contacts.find(c => c.id === id)) return;
    contacts.push({ id, name, history: [], unread: 0 }); 
    saveContactsToStorage();
    renderChatList();
}

function saveContactsToStorage() {
    // We don't save 'isTyping' to storage, it's real-time only
    const toSave = contacts.map(c => {
        const { isTyping, ...rest } = c; 
        return rest;
    });
    localStorage.setItem('p2p_contacts', JSON.stringify(toSave));
}

function getContact(id) { return contacts.find(c => c.id === id); }
function formatId(id) { return id.replace(/(\d{5})(\d{5})/, "$1-$2"); }
function formatTime(ts) { 
    return new Date(ts).toLocaleTimeString([], {
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true
    }); 
}

function scrollToBottom() { const c = document.getElementById('messages-container'); c.scrollTop = c.scrollHeight; }

function toggleAttachmentDrawer() {
    const drawer = document.getElementById('attachment-drawer');
    const backdrop = document.getElementById('transparent-backdrop');
    
    // જો ડ્રોઅર ખુલતું હોય તો બેકડ્રોપ બતાવો
    if (!drawer.classList.contains('open')) {
        drawer.classList.add('open');
        backdrop.classList.add('show');
    } else {
        closeAllPopups(); // બંધ કરવા માટે સેન્ટ્રલ ફંક્શન
    }
}
function triggerInput(inputId) {
    closeAllPopups(); // ડ્રોઅર અને બેકડ્રોપ બંને બંધ કરશે
    document.getElementById(inputId).click();
}

// --- PRO AUDIO RECORDING (NATIVE + REAL WAVEFORM) ---

let audioStream = null;
let nativeMediaRecorder = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let scriptProcessor = null;
let recordedAmplitudes = []; // Stores loudness (0-100)
let recordingTimerInterval = null;

async function toggleAudioRecord() {
    closeAllPopups();
    document.getElementById('audio-recording-ui').style.display = 'flex';
    document.getElementById('recording-timer').innerText = "00:00";
    
    recordedAmplitudes = []; // Reset waveform data
    audioChunks = []; // Reset audio data

    try {
        // 1. માઈક્રોફોન પરમિશન એક જ વાર માંગો
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream = stream;

        // 2. Native MediaRecorder શરૂ કરો
        nativeMediaRecorder = new MediaRecorder(stream);
        
        nativeMediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        nativeMediaRecorder.start();

        // 3. એ જ સ્ટ્રીમનો ઉપયોગ કરીને વેવફોર્મ શરૂ કરો (ડબલ પરમિશનની જરૂર નહીં)
        startWaveformAnalyzer(stream);

        // 4. ટાઈમર શરૂ કરો
        let seconds = 0;
        recordingTimerInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2,'0');
            const secs = (seconds % 60).toString().padStart(2,'0');
            document.getElementById('recording-timer').innerText = `${mins}:${secs}`;
        }, 1000);

    } catch (err) {
        console.error("Microphone error:", err);
        alert("Microphone access denied or error. Please check browser permissions and ensure you are using HTTPS.");
        document.getElementById('audio-recording-ui').style.display = 'none';
    }
}

function startWaveformAnalyzer(stream) {
    // વિઝ્યુઅલાઈઝેશન માટે AudioContext
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // સીધું સ્ટ્રીમ વાપરો (ફરીથી getUserMedia કોલ કરવાની જરૂર નથી)
    microphone = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; 
    scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

    microphone.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    scriptProcessor.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);

        // સરેરાશ વોલ્યુમ ગણતરી (Amplitude)
        let values = 0;
        const length = array.length;
        for (let i = 0; i < length; i++) {
            values += array[i];
        }
        const average = values / length;

        // ડેટા બહુ વધી ન જાય એટલે લિમિટ રાખો
        if(recordedAmplitudes.length < 50) { 
            recordedAmplitudes.push(Math.round(average)); 
        } else {
            // લાંબા રેકોર્ડિંગ માટે પણ ડેટા લેતા રહો (UI પર 30 bars જ દેખાશે)
            recordedAmplitudes.push(Math.round(average));
        }
    };
}

function stopAndSendAudio() {
    if (!nativeMediaRecorder || nativeMediaRecorder.state === "inactive") return;

    nativeMediaRecorder.onstop = () => {
        // 1. Audio Blob બનાવો (WebM/Ogg ફોર્મેટ જે બધા બ્રાઉઝરમાં ચાલે)
        const blob = new Blob(audioChunks, { type: 'audio/webm' }); 
        
        // ફાઈલનું નામ બનાવો
        const file = new File([blob], `voice_${Date.now()}.webm`, {
            type: 'audio/webm',
            lastModified: Date.now()
        });

        // 2. વેવફોર્મ ડેટાને 30 બારમાં રિસેમ્પલ કરો
        const finalWaveform = resampleWaveform(recordedAmplitudes, 30);

        // 3. અપલોડ અને સેન્ડ કરો
        uploadAudioWithMetadata(file, finalWaveform);

        cleanupRecording();
    };

    nativeMediaRecorder.stop();
}

function cancelAudioRecord() {
    if(nativeMediaRecorder && nativeMediaRecorder.state !== "inactive") {
        nativeMediaRecorder.stop();
    }
    cleanupRecording();
}

function cleanupRecording() {
    clearInterval(recordingTimerInterval);
    document.getElementById('audio-recording-ui').style.display = 'none';
    
    // માઈક્રોફોન અને કોન્ટેક્સ્ટ બંધ કરો
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    audioChunks = [];
    nativeMediaRecorder = null;
}


// Helper: Resample array to exactly 'targetLength' (e.g., 30 bars)
function resampleWaveform(data, targetLength) {
    if (!data || data.length === 0) return Array(targetLength).fill(10); // Default flat
    
    const blockSize = Math.floor(data.length / targetLength);
    const resampled = [];

    for (let i = 0; i < targetLength; i++) {
        // Pick a representative value from the block (Max looks better for voice)
        const start = i * blockSize;
        let end = start + blockSize;
        if(end > data.length) end = data.length;
        
        let maxVal = 0;
        for(let j=start; j<end; j++) {
            if(data[j] > maxVal) maxVal = data[j];
        }
        
        // Ensure minimum height for visibility (e.g. 10%)
        resampled.push(Math.max(10, maxVal));
    }
    return resampled;
}

// Modified Upload function to accept Waveform Data
// app.js માં uploadAudioWithMetadata ફંક્શનમાં

async function uploadAudioWithMetadata(file, waveform) {
    // 1. Upload to Cloudinary
    const cloudUrl = await uploadToCloudinary(file, 'video'); 
    if(!cloudUrl) return;

    // 2. Save to Firestore with WAVEFORM
    try {
        await window.fs.addDoc(window.fs.collection(window.db, "messages"), {
            content: cloudUrl, 
            fileName: file.name,
            fileSize: file.size,
            sender: myId,
            receiver: currentChatId,
            participants: [myId, currentChatId],
            timestamp: Date.now(),
            type: 'audio',
            
            // 🔥 આ લાઈન્સ અપડેટ કરો:
            status: 'sent',
            deliveredAt: null,  // <--- આ લાઈન ઉમેરો
            readAt: null,
            
            waveform: waveform 
        });
        playAppSound('send');
    } catch (e) { console.error(e); }
}

function toggleAddContactModal() { document.getElementById('modal-add-contact').classList.toggle('open'); }
// Open Full Screen Settings
function openSettings() {
    const view = document.getElementById('view-settings');
    view.classList.add('active'); // Slide in
    
    // Slide animation trigger (similar to chat room)
    setTimeout(() => {
        view.style.transform = "translateX(0)";
    }, 10);
}

// Close Settings
function closeSettings() {
    const view = document.getElementById('view-settings');
    view.style.transform = "translateX(100%)"; // Slide out
    
    setTimeout(() => {
        view.classList.remove('active');
    }, 300); // Wait for animation
}

function addNewContact() {
    const idInput = document.getElementById('input-friend-id');
    const nameInput = document.getElementById('input-friend-name'); // 🔥 Naya Input fetch kiya
    
    const id = idInput.value.trim();
    const customName = nameInput.value.trim(); // 🔥 Value nikali

    if (id.length !== 10) return alert("ID must be 10 digits");

    // 🔥 Logic: Agar naam diya hai to wo use karo, warna default "User ID"
    const finalName = customName ? customName : "User " + id;

    saveContact(id, finalName);
    
    // Inputs clear karein taaki agli baar khali mile
    idInput.value = "";
    nameInput.value = "";

    toggleAddContactModal();
    openChat(id);
}

function copyMyId() { navigator.clipboard.writeText(myId);  }
function clearAllData() { if(confirm("Reset all data?")) { localStorage.clear(); location.reload(); } }
function openChatOptions() { alert("Chat Info: Secured by Firebase"); }

async function updateProfileName(newName) {
    if (!newName) return;

    myName = newName;
    localStorage.setItem('p2p_my_name', myName);

    // 🔥 Firestore realtime update
    await window.fs.setDoc(
        window.fs.doc(window.db, "users", myId),
        { name: myName },
        { merge: true }
    );

    renderChatList();
}
async function updateProfileAvatar(files) {
    if (!files || !files[0]) return;

    const statusEl = document.getElementById('avatar-upload-status');

    // 🔵 SHOW UPLOADING
    statusEl.style.display = "block";
    statusEl.innerHTML = "Uploading <span class='typing-wave'>...</span>";

    try {
        const url = await uploadToCloudinary(files[0], "image");
        if (!url) throw new Error("Upload failed");

        myAvatar = url;
        localStorage.setItem('p2p_my_avatar', myAvatar);
        updateAvatarUI(myAvatar);

        // 🔥 Firestore realtime update
        await window.fs.setDoc(
            window.fs.doc(window.db, "users", myId),
            { avatar: myAvatar },
            { merge: true }
        );

    } catch (e) {
        statusEl.innerText = "Upload failed ❌";
        setTimeout(() => statusEl.style.display = "none", 2000);
        return;
    }

    // ✅ HIDE AFTER SUCCESS
    statusEl.style.display = "none";
}
function updateAvatarUI(src) {
    const img = document.getElementById('my-avatar-img');
    const icon = document.getElementById('default-avatar-icon');
    if(src) { img.src = src; img.style.display='block'; icon.style.display='none'; }
    else { img.style.display='none'; icon.style.display='block'; }
}

// --- PRESENCE / ONLINE STATUS SYSTEM ---

let heartbeatInterval;

function startPresenceSystem() {
    updateUserStatus(true);
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        updateUserStatus(true);
    }, 60000); 

    window.addEventListener("beforeunload", () => {
        updateUserStatus(false);
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible') {
            updateUserStatus(true);
        } else {
            updateUserStatus(false);
        }
    });
}

async function updateUserStatus(isOnline) {
    if (!myId || !window.db) return;
    try {
        const userRef = window.fs.doc(window.db, "users", myId);
        await window.fs.setDoc(userRef, {
            online: isOnline,
            lastSeen: window.fs.serverTimestamp()
        }, { merge: true });
    } catch (e) { console.log("Status update error:", e); }
}

// --- TYPING LOGIC ---
let typingTimeout;

function handleTyping() {
    if (!currentChatId) return;
    setTypingStatus(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        setTypingStatus(false);
    }, 2000);
}

async function setTypingStatus(isTyping) {
    if (!myId || !currentChatId) return;
    try {
        const userRef = window.fs.doc(window.db, "users", myId);
        await window.fs.updateDoc(userRef, {
            typingTo: isTyping ? currentChatId : null
        });
    } catch (e) { console.error("Typing status error", e); }
}
// --- MEDIA VIEWER LOGIC (ZOOM & PAN ENABLED) ---
let currentRotation = 0;
let currentScale = 1;
let currentPosX = 0;
let currentPosY = 0;
let startX = 0, startY = 0;
let initialPinchDistance = 0;
let isDragging = false;

// Media Element Ref
let activeMediaElement = null;

function openMediaViewer(src, type, name) {
    const viewer = document.getElementById('media-viewer');
    const title = document.getElementById('media-name');
    const menu = document.getElementById('media-menu-dropdown');

    viewer.style.display = 'flex';
    title.innerText = name || "Media";
    
    // 🔥 Reset Zoom/Pan State
    currentRotation = 0;
    currentScale = 1;
    currentPosX = 0;
    currentPosY = 0;
    if(menu) menu.classList.remove('show');

    // --- 🔥 NEW NAVIGATION LOGIC START ---
    currentMediaList = [];
    currentMediaIndex = -1;

    // જો કોઈ ચેટ ખુલ્લી હોય, તો તેમાંથી બધા મીડિયા શોધો
    if (currentChatId) {
        const contact = getContact(currentChatId);
        if (contact && contact.history) {
            // ખાલી Image અને Video જ લિસ્ટમાં લો
            currentMediaList = contact.history.filter(m => m.type === 'image' || m.type === 'video');
            
            // અત્યારે જે ખોલ્યું છે, તેનો Index શોધો
            currentMediaIndex = currentMediaList.findIndex(m => m.content === src);
        }
    }
    // --- NEW NAVIGATION LOGIC END ---

    // મીડિયા રેન્ડર કરો (આ નીચે નવું બનાવેલું ફંક્શન છે)
    renderMediaItem(src, type);
    attachViewerEvents();
}
function renderMediaItem(src, type) {
    const viewer = document.getElementById('media-viewer');
    
    // Check if wrapper exists, if not create it
    let wrapper = document.getElementById('media-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'media-wrapper';
        wrapper.className = 'media-content-wrapper';
        
        // Move existing img/video inside wrapper
        const img = document.getElementById('viewer-img');
        const vidWrapper = document.getElementById('video-wrapper');
        
        // Clear viewer content temporarily to restructure
        while (viewer.children.length > 0) {
            // Don't remove controls/buttons, just media
             const child = viewer.children[0];
             if(child.id === 'viewer-img' || child.id === 'video-wrapper') {
                 wrapper.appendChild(child);
             } else {
                 // Keep buttons outside wrapper but inside viewer? 
                 // Actually, simpler: append wrapper to viewer
                 break; 
             }
        }
        // For safety, let's just append wrapper if empty or restructure:
        // This part is tricky dynamically, so let's just ensure elements are inside.
        // EASIER WAY: Just target the wrapper in logic.
        // Let's assume user manually updates HTML or we do it here cleanly:
    }
    
    // --- SIMPLER RENDER LOGIC ---
    const img = document.getElementById('viewer-img');
    const vidWrapper = document.getElementById('video-wrapper');
    const vid = document.getElementById('viewer-video');
    const rotateBtn = document.getElementById('rotate-btn');

    // Make sure we have a wrapper logic handled in ZoomEvents
    // Reset positions
    if(activeMediaElement) {
        activeMediaElement.style.transform = `scale(1) rotate(0deg)`;
    }
    
    // Reset Wrapper Position
    const contentWrapper = document.getElementById('media-content-wrapper-box'); // We will add this ID in HTML step or assume
    if(contentWrapper) {
        contentWrapper.style.transform = 'translateX(0px)';
        contentWrapper.classList.remove('snap-transition');
    }

    if (type === 'image') {
        img.src = src;
        img.style.display = 'block';
        vidWrapper.style.display = 'none';
        vid.pause();
        activeMediaElement = img;
        if(rotateBtn) rotateBtn.style.display = 'flex';
    } else {
        img.style.display = 'none';
        vidWrapper.style.display = 'flex';
        vid.src = src;
        activeMediaElement = vid;
        if(rotateBtn) rotateBtn.style.display = 'none';
    }

    currentScale = 1;
    currentRotation = 0;
    currentPosX = 0;
    currentPosY = 0;
    
    // 🔥 Preload next images to avoid black screen
    preloadNextMedia();

    // Re-attach events to the VIEWER (Black area), not just the image
    attachViewerEvents();
}



function updateMediaTransform() {
    if(!activeMediaElement) return;
    // Combine Translate (Pan), Rotate, and Scale (Zoom)
    activeMediaElement.style.transform = 
        `translate(${currentPosX}px, ${currentPosY}px) rotate(${currentRotation}deg) scale(${currentScale})`;
}
function attachViewerEvents() {
    const viewer = document.getElementById('media-viewer');
    const element = activeMediaElement; // Img or Video

    if (!viewer || !element) return;

    // Unbind old events to prevent duplication
    viewer.ontouchstart = null;
    viewer.ontouchmove = null;
    viewer.ontouchend = null;

    viewer.ontouchstart = (e) => {
        // જો 2 આંગળી હોય તો Zoom લોજિક (Pinch)
        if (e.touches.length === 2) {
            isDragging = false;
            isSwiping = false;
            initialPinchDistance = getDistance(e.touches);
            return;
        }

        // 1 Finger Touch
        if (e.touches.length === 1) {
            swipeStartX = e.touches[0].clientX;
            swipeStartY = e.touches[0].clientY;
            
            // જો Zoom કરેલું હોય તો Pan (Image move) કરો, Swipe નહીં
            if (currentScale > 1) {
                isDragging = true;
                isSwiping = false;
                startX = e.touches[0].clientX - currentPosX;
                startY = e.touches[0].clientY - currentPosY;
            } else {
                // Zoom નથી, તો Swipe માટે તૈયારી
                isDragging = false; 
                isSwiping = true;
                currentTranslateX = 0;
                
                // Real-time movement માટે Transition હટાવી દો
                element.style.transition = 'none';
            }
        }
    };

    viewer.ontouchmove = (e) => {
        e.preventDefault(); // Browser Scroll રોકો

        if (e.touches.length === 2) {
            // --- ZOOM LOGIC ---
            const newDistance = getDistance(e.touches);
            const scaleChange = newDistance / initialPinchDistance;
            let newScale = currentScale * scaleChange;
            if (newScale < 1) newScale = 1; 
            if (newScale > 5) newScale = 5;
            currentScale = newScale;
            initialPinchDistance = newDistance; 
            updateMediaTransform();
            return;
        }

        if (currentScale > 1 && isDragging) {
            // --- PAN LOGIC (Zoomed Move) ---
            currentPosX = e.touches[0].clientX - startX;
            currentPosY = e.touches[0].clientY - startY;
            updateMediaTransform();
        } 
        else if (currentScale === 1 && isSwiping) {
            // --- SWIPE LOGIC (1:1 Finger Movement) ---
            let currentX = e.touches[0].clientX;
            let diffX = currentX - swipeStartX;
            
            // વર્તમાન પોઝિશન અપડેટ કરો (સાથે ખસશે)
            currentTranslateX = diffX;
            
            // Image ને ખસેડો (Rotation 0 રહેશે)
            element.style.transform = `translateX(${diffX}px)`;
        }
    };

    viewer.ontouchend = (e) => {
        // --- ZOOM/PAN END ---
        isDragging = false;
        
        // --- SWIPE END LOGIC ---
        if (isSwiping && currentScale === 1) {
            isSwiping = false;
            
            const screenWidth = window.innerWidth;
            const threshold = 0; // 35% સ્ક્રીન ખસે તો જ બદલાય

            // 1. Next Image Logic (Swipe Left)
            if (currentTranslateX < -threshold) {
                // બહાર મોકલી દો (Complete Animation)
                element.style.transition = 'transform 0.2s ease-out';
                element.style.transform = `translateX(-100vw)`;
                
                setTimeout(() => changeMedia(1), 200); // Change logic call
            } 
            // 2. Previous Image Logic (Swipe Right)
            else if (currentTranslateX > threshold) {
                element.style.transition = 'transform 0.2s ease-out';
                element.style.transform = `translateX(100vw)`;
                
                setTimeout(() => changeMedia(-1), 200);
            } 
            // 3. Snap Back (અડધેથી છોડી દીધું)
            else {
                element.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
                element.style.transform = `translateX(0px)`;
            }
        }
    };
}

function attachZoomEvents(el) {
    el.ontouchstart = (e) => {
        if (e.touches.length === 2) {
            // Pinch Start
            isDragging = false;
            initialPinchDistance = getDistance(e.touches);
        } else if (e.touches.length === 1) {
            // Pan Start OR Swipe Start
            // 🔥 Swipe માટે Start Point નોંધી લો
            swipeStartX = e.touches[0].clientX;
            swipeStartY = e.touches[0].clientY;

            if (currentScale > 1) {
                isDragging = true;
                startX = e.touches[0].clientX - currentPosX;
                startY = e.touches[0].clientY - currentPosY;
            }
        }
    };

    el.ontouchmove = (e) => {
        e.preventDefault(); // Browser scroll rokein

        if (e.touches.length === 2) {
            // Pinching (Zooming)
            const newDistance = getDistance(e.touches);
            const scaleChange = newDistance / initialPinchDistance;
            
            // Limit Zoom
            let newScale = currentScale * scaleChange;
            if (newScale < 1) newScale = 1; 
            if (newScale > 5) newScale = 5;

            currentScale = newScale;
            initialPinchDistance = newDistance; 
            updateMediaTransform();

        } else if (e.touches.length === 1 && isDragging && currentScale > 1) {
            // Panning (Moving ONLY when zoomed in)
            currentPosX = e.touches[0].clientX - startX;
            currentPosY = e.touches[0].clientY - startY;
            updateMediaTransform();
        }
    };

    el.ontouchend = (e) => {
        isDragging = false;

        // 🔥 SWIPE DETECTION LOGIC (Only if Scale is 1)
        if (currentScale === 1 && e.changedTouches.length === 1) {
            let swipeEndX = e.changedTouches[0].clientX;
            let swipeEndY = e.changedTouches[0].clientY;
            
            let diffX = swipeStartX - swipeEndX;
            let diffY = swipeStartY - swipeEndY;

            // જો Horizontal Swipe 50px થી વધારે હોય અને Vertical હલનચલન ઓછું હોય
            if (Math.abs(diffX) > 50 && Math.abs(diffY) < 40) {
                if (diffX > 0) {
                    // Swipe Left -> Next Image
                    changeMedia(1);
                } else {
                    // Swipe Right -> Previous Image
                    changeMedia(-1);
                }
            }
        }

        // Reset if zoomed out too much
        if (currentScale < 1) {
            currentScale = 1;
            currentPosX = 0;
            currentPosY = 0;
            updateMediaTransform();
        }
    };
}
function changeMedia(direction) {
    if (!currentMediaList || currentMediaList.length <= 1) {
        // જો લિસ્ટ નથી, તો પાછું લાવી દો
        activeMediaElement.style.transform = `translateX(0px)`;
        return;
    }

    let newIndex = currentMediaIndex + direction;

    if (newIndex >= 0 && newIndex < currentMediaList.length) {
        currentMediaIndex = newIndex;
        const nextMedia = currentMediaList[currentMediaIndex];

        // 1. ડેટા અપડેટ કરો
        document.getElementById('media-name').innerText = nextMedia.fileName || "Media";

        // 2. ઈમેજ બદલો (Preload ને કારણે Cache માં હશે જ)
        renderMediaItem(nextMedia.content, nextMedia.type);
        
        // 3. નવી ઈમેજ ને Slide In Effect આપો
        const newEl = activeMediaElement;
        
        // શરૂઆતમાં નવી ઈમેજ ક્યાં હોવી જોઈએ?
        // જો Next કર્યું હોય તો Right side થી આવે, Prev હોય તો Left થી
        const startPos = direction === 1 ? '100vw' : '-100vw';
        
        newEl.style.transition = 'none'; // Instant set
        newEl.style.transform = `translateX(${startPos})`;
        
        // થોડી વાર પછી Center માં લાવો (Animation)
        requestAnimationFrame(() => {
            setTimeout(() => {
                newEl.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
                newEl.style.transform = `translateX(0px)`;
            }, 10);
        });

    } else {
        // લિસ્ટ પૂરું થઈ ગયું - Snap Back
        activeMediaElement.style.transition = 'transform 0.3s ease-out';
        activeMediaElement.style.transform = `translateX(0px)`;
    }
}


// Helper: Ungliyon ke beech ka distance
function getDistance(touches) {
    return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );
}

function closeMediaViewer() {
    document.getElementById('media-viewer').style.display = 'none';
    document.getElementById('viewer-video').pause();
    activeMediaElement = null;
}

function rotateMedia() {
    if(activeMediaElement) {
        currentRotation += 90;
        updateMediaTransform(); // Naya function use karein
        toggleMediaMenu();
    }
}




async function shareMedia() {
    const title = document.getElementById('media-name').innerText;
    const img = document.getElementById('viewer-img');
    const vid = document.getElementById('viewer-video');
    
    const url = img.style.display !== 'none' ? img.src : vid.src;

    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: 'Check this out on P2P Connect',
                url: url
            });
        } catch (err) { console.log('Share failed', err); }
    } else {
        alert("Sharing not supported on this browser.");
    }
    toggleMediaMenu();
}

// --- VIDEO SPEED LOGIC ---
function expandSpeedControl() {
    const pill = document.getElementById('speed-pill');
    pill.classList.add('expanded');
    
    // Auto collapse if mouse leaves or after 5 seconds of inactivity
    const collapse = () => pill.classList.remove('expanded');
    
    pill.onmouseleave = collapse;
    pill.ontouchend = () => setTimeout(collapse, 3000); // Mobile fix
}

function changeVideoSpeed(val) {
    const vid = document.getElementById('viewer-video');
    vid.playbackRate = parseFloat(val);
}
function updateSpeedUI(val) {
    document.getElementById('speed-val-display').innerText = val + 'x';
}

// --- AUDIO PLAYER LOGIC ---
let currentPlayingAudio = null;

function toggleAudio(id, src) {
    const audio = document.getElementById(id);
    const btn = document.getElementById('btn-' + id);
    
    // Pause currently playing if different
    if (currentPlayingAudio && currentPlayingAudio !== audio) {
        currentPlayingAudio.pause();
        const oldId = currentPlayingAudio.id;
        document.getElementById('btn-' + oldId).className = 'audio-control-btn paused';
        document.getElementById('btn-' + oldId).innerHTML = '<span class="material-icons-round">play_arrow</span>';
    }

    if (audio.paused) {
        audio.play();
        currentPlayingAudio = audio;
        btn.className = 'audio-control-btn playing';
        btn.innerHTML = '<span class="material-icons-round">pause</span>';
    } else {
        audio.pause();
        btn.className = 'audio-control-btn paused'; // Gray when paused
        btn.innerHTML = '<span class="material-icons-round">play_arrow</span>';
        // Note: Progress bar stays blue at current position
    }
}
// --- MISSING FUNCTION ADDED HERE ---
function toggleMediaMenu() {
    const menu = document.getElementById('media-menu-dropdown');
    // મેનુ દેખાય/અદ્રશ્ય થાય તે માટે ટોગલ કરો
    if (menu) {
        menu.classList.toggle('show');
    }
}

// જ્યારે મીડિયા વ્યૂઅર બંધ થાય ત્યારે મેનુ પણ બંધ થવું જોઈએ
function closeMediaViewer() {
    document.getElementById('media-viewer').style.display = 'none';
    const vid = document.getElementById('viewer-video');
    if(vid) vid.pause();
    
    // 🔥 મેનુ રીસેટ કરો જેથી બીજી વાર ખોલતી વખતે ખુલ્લું ન રહે
    const menu = document.getElementById('media-menu-dropdown');
    if (menu) menu.classList.remove('show');

    activeMediaElement = null;
}

function updateAudioUI(id) {
    const audio = document.getElementById(id);
    const fill = document.getElementById('fill-' + id);
    const timeDisplay = document.getElementById('time-' + id);
    
    if(audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        fill.style.width = pct + '%';
        
        const rem = audio.duration - audio.currentTime;
        const mins = Math.floor(rem / 60);
        const secs = Math.floor(rem % 60).toString().padStart(2, '0');
        timeDisplay.innerText = `${mins}:${secs}`;
    }
}

function resetAudioUI(id) {
    const btn = document.getElementById('btn-' + id);
    const fill = document.getElementById('fill-' + id);
    const timeDisplay = document.getElementById('time-' + id);
    
    btn.className = 'audio-control-btn paused';
    btn.innerHTML = '<span class="material-icons-round">play_arrow</span>';
    fill.style.width = '0%';
    
    // Reset time display to full duration
    const audio = document.getElementById(id);
    initAudioDuration(id);
}

function initAudioDuration(id) {
    const audio = document.getElementById(id);
    const timeDisplay = document.getElementById('time-' + id);
    if(audio.duration) {
        const mins = Math.floor(audio.duration / 60);
        const secs = Math.floor(audio.duration % 60).toString().padStart(2, '0');
        timeDisplay.innerText = `${mins}:${secs}`;
    }
}

function toggleAppSetting(key, value) {
    appSettings[key] = value;
    localStorage.setItem('p2p_settings', JSON.stringify(appSettings));
}

function playAppSound(type) {
    if (!appSettings.sound) return;
    
    // We create a temporary audio element to allow overlapping sounds
    const audio = new Audio(type === 'send' ? AUDIO_SRC_SEND : AUDIO_SRC_RECV);
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio play blocked:", e));
}

// Helper to manually load media
// 🔥 FIX: Save download state permanently
window.manualLoadMedia = function(btnElement, type, url, fileName, msgId, chatId) {
    // 1. Find and update local storage
    const contact = contacts.find(c => c.id === chatId);
    if (contact) {
        const msg = contact.history.find(m => m.id === msgId);
        if (msg) {
            msg.isDownloaded = true; // ✅ Mark as permanently downloaded
            saveContactsToStorage(); // ✅ Save to LocalStorage
        }
    }

    // 2. UI Update (Show content instantly)
    const container = btnElement.closest('.manual-download-overlay').parentNode;
    let html = '';
    
    // Video/Image/File Logic (Same as before)
    if (type === 'image') {
        html = `<img src="${url}" onclick="openMediaViewer('${url}', 'image', '${fileName}')" style="max-width:100%; border-radius:12px; margin-bottom:5px; cursor:pointer;">`;
    } else if (type === 'video') {
        // Updated Video style from previous request
        html = `<div style="position:relative; cursor:pointer; display: flex; align-items: center; justify-content: center; line-height: 0; border-radius: 12px; overflow: hidden;" onclick="openMediaViewer('${url}', 'video', '${fileName}')">
                <video src="${url}" style="width:100%; height:auto; display:block; border-radius:12px;"></video>
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(0,0,0,0.5); border-radius:50%; padding:10px; display:flex; align-items:center; justify-content:center;">
                    <span class="material-icons-round" style="color:white; font-size:30px;">play_arrow</span>
                </div>
            </div>`;
    } else {
        html = `<div class="file-card-content">
                <div class="file-icon-box"><span class="material-icons-round">description</span></div>
                <div style="flex:1;"><a href="${url}" target="_blank" style="color:inherit;text-decoration:none;">${fileName}</a></div>
            </div>`;
    }
    
    container.innerHTML = html + container.innerHTML.split('</div>').pop(); 
    setTimeout(scrollToBottom, 100);
}

function toggleChatMenu() {
    const menu = document.getElementById('chat-menu');
    const backdrop = document.getElementById('transparent-backdrop');

    if (!menu.classList.contains('show')) {
        menu.classList.add('show');
        backdrop.classList.add('show');
    } else {
        closeAllPopups();
    }
}

function clearCurrentChat() {
    if (!currentChatId) return;

    const contact = getContact(currentChatId);
    if (!contact) return;

    contact.history = [];
    contact.unread = 0;

    saveContactsToStorage();
    renderMessages(currentChatId);
    renderChatList();

    document.getElementById('chat-menu').classList.remove('show');
}
// --- SELECTION & LONG PRESS LOGIC ---

// 1. Enter Selection Mode
function selectChat(id) {
    // Toggle ID in Set
    if (selectedChatIds.has(id)) {
        selectedChatIds.delete(id);
    } else {
        selectedChatIds.add(id);
    }

    // If no items left, exit mode
    if (selectedChatIds.size === 0) {
        exitSelectionMode();
        return;
    }
    
    // Switch Header Views
    document.getElementById('header-main').style.display = 'none';
    document.getElementById('header-selection').style.display = 'block';
    
    // Update Header Buttons & Count
    updateSelectionHeader();
    
    // Re-render list to show highlights
    renderChatList();
    
    // Vibrate (Android)
    if (navigator.vibrate) navigator.vibrate(50);
}
// Helper to update Buttons based on count
function updateSelectionHeader() {
    const count = selectedChatIds.size;
    document.getElementById('selection-count').innerText = `${count}`;

    const btnPin = document.getElementById('btn-sel-pin');
    const btnEdit = document.getElementById('btn-sel-edit');
    const btnDelete = document.getElementById('btn-sel-delete');

    // Logic:
    // 1 Chat: Edit, Pin, Delete
    // 2-3 Chats: Pin, Delete (No Edit)
    // >3 Chats: Delete only
    
    if (count === 1) {
        btnEdit.style.display = 'flex';
        btnPin.style.display = 'flex';
    } else if (count <= 3) {
        btnEdit.style.display = 'none';
        btnPin.style.display = 'flex';
    } else {
        btnEdit.style.display = 'none';
        btnPin.style.display = 'none';
    }
}

// 2. Exit Selection Mode
function exitSelectionMode() {
    selectedChatIds.clear();
    document.getElementById('header-main').style.display = 'block';
    document.getElementById('header-selection').style.display = 'none';
    renderChatList();
}

// 3. Delete Logic (Multiple)
function deleteSelectedChats() {
    if (selectedChatIds.size === 0) return;
    
    if (confirm(`Delete ${selectedChatIds.size} chat(s)? Messages will be cleared locally.`)) {
        // Filter out selected contacts
        contacts = contacts.filter(c => !selectedChatIds.has(c.id));
        saveContactsToStorage();
        
        // Reset Logic
        if (selectedChatIds.has(currentChatId)) currentChatId = null;
        exitSelectionMode();
    }
}

// 4. Rename Logic (Only works if 1 is selected)
function openRenameModal() {
    if (selectedChatIds.size !== 1) return;
    
    // Get the single ID
    const [id] = selectedChatIds; 
    const contact = getContact(id);
    
    if (contact) {
        document.getElementById('input-rename').value = contact.nickname || contact.name;
        document.getElementById('modal-rename').classList.add('open');
    }
}

function closeAllPopups() {
    // Hide Backdrop
    document.getElementById('transparent-backdrop').classList.remove('show');
    
    // Close Drawer
    document.getElementById('attachment-drawer').classList.remove('open');
    
    // Close Chat Menu
    const menu = document.getElementById('chat-menu');
    if (menu) menu.classList.remove('show');
    
    // બીજા કોઈ પોપઅપ હોય તો અહીં ઉમેરી શકાય
}
function closeRenameModal() {
    document.getElementById('modal-rename').classList.remove('open');
}

// 5. Save Custom Name (The "Persistence" Part)
function saveRenameContact() {
    const newName = document.getElementById('input-rename').value.trim();
    if (selectedChatIds.size !== 1) return;

    const [id] = selectedChatIds;
    const contact = getContact(id);
    
    if (contact && newName) {
        contact.nickname = newName;
        saveContactsToStorage();
        closeRenameModal();
        exitSelectionMode();
    }
}
// 5. 🔥 PIN LOGIC (New)
function togglePinChats() {
    if (selectedChatIds.size === 0) return;

    let anyPinned = false;
    
    // Check if any selected is already pinned to decide toggle direction
    // (If user selects mixed pinned/unpinned, we usually Pin all or Unpin all. 
    // Here: If any is unpinned, we Pin all. If all are pinned, we Unpin all.)
    const ids = Array.from(selectedChatIds);
    const areAllPinned = ids.every(id => {
        const c = getContact(id);
        return c && c.isPinned;
    });

    const newState = !areAllPinned; // Toggle

    contacts.forEach(c => {
        if (selectedChatIds.has(c.id)) {
            c.isPinned = newState;
        }
    });

    saveContactsToStorage();
    exitSelectionMode();
}
// --- DATE FORMATTER HELPER ---
function getDateLabel(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    // Remove time part for accurate date comparison
    const dStr = d.toDateString();
    const nowStr = now.toDateString();
    const yestStr = yesterday.toDateString();

    if (dStr === nowStr) return "Today";
    if (dStr === yestStr) return "Yesterday";

    // Check if within this week (Monday, Tuesday...)
    const diffTime = Math.abs(now - d);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays <= 6) {
        // Return Day Name (e.g., Saturday)
        return d.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Else return DD/MM/YYYY
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
// --- PRO PLAYBACK LOGIC (DUAL TIMERS) ---
let currentAudioObj = null;
let currentAudioId = null;
let audioUpdateFrame = null;

function playAudioMsg(url, elementId) {
    const btn = document.getElementById(`btn-${elementId}`);
    const track = document.getElementById(`track-${elementId}`);
    const curTimeEl = document.getElementById(`cur-${elementId}`);
    const remTimeEl = document.getElementById(`rem-${elementId}`);
    const bars = track.querySelectorAll('.wave-bar');

    // 1. Toggle Play/Pause on SAME Audio
    if (currentAudioObj && currentAudioId === elementId) {
        if (currentAudioObj.paused) {
            currentAudioObj.play();
            btn.innerHTML = '<span class="material-icons-round">pause</span>';
            btn.classList.add('playing');
            // Resume animation loop
            requestAnimationFrame(updateVisuals); 
        } else {
            currentAudioObj.pause();
            btn.innerHTML = '<span class="material-icons-round">play_arrow</span>';
            btn.classList.remove('playing');
        }
        return;
    }

    // 2. Stop Previous Audio (if any)
    if (currentAudioObj) {
        currentAudioObj.pause();
        const oldBtn = document.getElementById(`btn-${currentAudioId}`);
        if(oldBtn) {
            oldBtn.innerHTML = '<span class="material-icons-round">play_arrow</span>';
            oldBtn.classList.remove('playing');
        }
    }

    // 3. Setup New Audio
    currentAudioObj = new Audio(url);
    currentAudioId = elementId;
    
    btn.innerHTML = '<span class="material-icons-round">pause</span>';
    btn.classList.add('playing');
    currentAudioObj.play();

    // 4. Robust Animation Loop
    function updateVisuals() {
        // Exit if this is no longer the active audio or if it's paused
        if (!currentAudioObj || currentAudioId !== elementId || currentAudioObj.paused) return;

        const duration = currentAudioObj.duration;
        const current = currentAudioObj.currentTime;
        
        if (duration > 0 && isFinite(duration)) {
            // Update Timers
            curTimeEl.innerText = formatAudioTime(current);
            remTimeEl.innerText = "-" + formatAudioTime(duration - current);

            // Update Waves (Fill logic)
            const percent = current / duration;
            const activeCount = Math.floor(bars.length * percent);
            
            bars.forEach((bar, index) => {
                if (index <= activeCount) {
                    bar.classList.add('active');
                } else {
                    bar.classList.remove('active');
                }
            });
        }
        
        // Keep looping
        requestAnimationFrame(updateVisuals);
    }

    // Start Loop
    currentAudioObj.onplaying = () => {
        requestAnimationFrame(updateVisuals);
    };

    // Handle Metadata (Initial Duration)
    currentAudioObj.addEventListener('loadedmetadata', () => {
        if(isFinite(currentAudioObj.duration)){
             remTimeEl.innerText = "-" + formatAudioTime(currentAudioObj.duration);
        }
    });

    // Handle End
    currentAudioObj.addEventListener('ended', () => {
        btn.innerHTML = '<span class="material-icons-round">play_arrow</span>';
        btn.classList.remove('playing');
        curTimeEl.innerText = "0:00";
        if(isFinite(currentAudioObj.duration)){
            remTimeEl.innerText = "-" + formatAudioTime(currentAudioObj.duration);
        }
        bars.forEach(bar => bar.classList.remove('active'));
        currentAudioObj = null;
        currentAudioId = null;
    });
}

function formatAudioTime(seconds) {
    if(!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}
function getPersistentWaveform(msgId) {
    // Agar pehle se is message ki wave saved hai, toh wahi return karo
    if (localWaveforms[msgId]) {
        return localWaveforms[msgId];
    }

    // Warna nayi random wave banao (Real looking bars)
    const newWave = Array.from({ length: 30 }, () => Math.floor(Math.random() * 70) + 30);
    
    // Local storage mein save karo
    localWaveforms[msgId] = newWave;
    localStorage.setItem('chat_waveforms', JSON.stringify(localWaveforms));
    
    return newWave;
}
// --- MESSAGE SELECTION & EDITING LOGIC ---

function selectMessage(id) {
    // 1. Toggle Selection ID
    if (selectedMsgIds.has(id)) {
        selectedMsgIds.delete(id);
    } else {
        selectedMsgIds.add(id);
    }

    // 2. UI Update (Target the ROW, not the bubble)
    const row = document.getElementById(`row-${id}`);
    if(row) {
        if(selectedMsgIds.has(id)) row.classList.add('msg-selected');
        else row.classList.remove('msg-selected');
    }

    // 3. Header Logic
    if (selectedMsgIds.size > 0) {
        // Flex fix for header icons
        document.getElementById('header-msg-selection').style.display = 'flex'; 
        updateMsgSelectionHeader();
        
        // Android Vibrate
        if (navigator.vibrate) navigator.vibrate(50);
    } else {
        exitMsgSelectionMode();
    }
}

function exitMsgSelectionMode() {
    selectedMsgIds.clear();
    document.getElementById('header-msg-selection').style.display = 'none';
    
    // 🔥 Remove highlights from all ROWS
    document.querySelectorAll('.msg-row.msg-selected').forEach(el => el.classList.remove('msg-selected'));
}

function updateMsgSelectionHeader() {
    const count = selectedMsgIds.size;
    document.getElementById('msg-selection-count').innerText = count;

    const btnEdit = document.getElementById('btn-msg-edit');
    const btnView = document.getElementById('btn-msg-view');
    const btnDelete = document.getElementById('btn-msg-delete'); // Always shown

    // Hide everything first
    btnEdit.style.display = 'none';
    btnView.style.display = 'none';

    // Logic: Only 1 item selected?
    if (count === 1) {
        const [id] = selectedMsgIds;
        const contact = getContact(currentChatId);
        const msg = contact.history.find(m => m.id === id);

        if (msg) {
            // Rule 1: Show View Mode only if TEXT
            if (msg.type === 'text') {
                btnView.style.display = 'flex';
            }

            // Rule 2: Show Edit only if SENT BY ME & < 15 MINS
            if (msg.side === 'sent') {
                const now = Date.now();
                const diffMins = (now - msg.timestamp) / (1000 * 60);
                if (diffMins <= 15) {
                    btnEdit.style.display = 'flex';
                }
            }
        }
    }
    // If count > 1, only Delete is visible (default)
}

// --- DELETE MESSAGES ---
async function deleteSelectedMessages() {
    if (selectedMsgIds.size === 0) return;
    if (!confirm(`Delete ${selectedMsgIds.size} message(s)?`)) return;

    const idsToDelete = Array.from(selectedMsgIds);
    exitMsgSelectionMode(); // Close UI first

    // 1. Local Update
    const contact = getContact(currentChatId);
    if(contact) {
        contact.history = contact.history.filter(m => !idsToDelete.includes(m.id));
        saveContactsToStorage();
        renderMessages(currentChatId); // Re-render to remove bubbles
    }

    // 2. Firebase Update (Loop delete)
    // Note: In real app, batch write is better. Here simplistic approach.
    idsToDelete.forEach(async (id) => {
        try {
            await window.fs.deleteDoc(window.fs.doc(window.db, "messages", id));
        } catch(e) { console.error("Delete error", e); }
    });
}

// --- EDIT MESSAGES ---
function openEditMessageModal() {
    if (selectedMsgIds.size !== 1) return;
    const [id] = selectedMsgIds;
    const contact = getContact(currentChatId);
    const msg = contact.history.find(m => m.id === id);

    if (msg && msg.type === 'text') {
        const input = document.getElementById('input-edit-msg');
        input.value = msg.content;
        document.getElementById('modal-edit-msg').classList.add('open');
    }
}

async function saveEditedMessage() {
    const newText = document.getElementById('input-edit-msg').value.trim();
    if (!newText || selectedMsgIds.size !== 1) return;

    const [id] = selectedMsgIds;
    document.getElementById('modal-edit-msg').classList.remove('open');
    exitMsgSelectionMode();

    // 1. Local Update
    const contact = getContact(currentChatId);
    const msg = contact.history.find(m => m.id === id);
    if (msg) {
        msg.content = newText;
        msg.isEdited = true;
        saveContactsToStorage();
        renderMessages(currentChatId);
    }

    // 2. Firebase Update
    try {
        await window.fs.updateDoc(window.fs.doc(window.db, "messages", id), {
            content: newText,
            isEdited: true
        });
    } catch(e) { console.error("Edit error", e); }
}

// --- TEXT VIEW MODE ---
function openTextMode() {
    if (selectedMsgIds.size !== 1) return;
    const [id] = selectedMsgIds;
    const contact = getContact(currentChatId);
    const msg = contact.history.find(m => m.id === id);

    if (msg && msg.type === 'text') {
        const contentDiv = document.getElementById('text-mode-content');
        contentDiv.innerText = msg.content; // Plain text injection
        
        document.getElementById('view-text-mode').classList.add('active');
        exitMsgSelectionMode(); // Selection mode band kar do background mein
    }
}

function closeTextMode() {
    document.getElementById('view-text-mode').classList.remove('active');
}
// --- EXPANDED EDITOR LOGIC ---

// 1. Open the Editor (Copy text from small input to large input)
function openExpandedEditor() {
    const smallInput = document.getElementById('msg-input');
    const largeInput = document.getElementById('editor-input-large');
    
    largeInput.value = smallInput.value;
    document.getElementById('view-editor-mode').classList.add('active');
    
    // Android keyboard fix: wait slightly then focus
    setTimeout(() => {
        largeInput.focus();
        // Cursor at end
        largeInput.setSelectionRange(largeInput.value.length, largeInput.value.length);
    }, 100);
}

// 2. Close/Shrink Editor (Copy text back to small input)
function closeExpandedEditor() {
    const smallInput = document.getElementById('msg-input');
    const largeInput = document.getElementById('editor-input-large');
    
    smallInput.value = largeInput.value;
    document.getElementById('view-editor-mode').classList.remove('active');
    
    // Trigger resize on small input to match new content
    autoResizeTextarea();
    smallInput.focus();
}

// 3. Send Message directly from Editor
function sendFromEditor() {
    const largeInput = document.getElementById('editor-input-large');
    const smallInput = document.getElementById('msg-input');
    
    // Sync value back to main input
    smallInput.value = largeInput.value;
    
    // Close editor
    document.getElementById('view-editor-mode').classList.remove('active');
    
    // Trigger Main Send Function
    sendMessage();
}

// 4. Formatting Logic (WhatsApp Style: *Bold*, _Italic_, ~Strike~, ```Mono```)
function applyTextFormat(type) {
    const textarea = document.getElementById('editor-input-large');
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // If no text is selected, do nothing or just insert markers (User requested "select karke click kare")
    if (start === end) return; 

    const fullText = textarea.value;
    const selectedText = fullText.substring(start, end);
    
    let symbol = '';
    
    switch(type) {
        case 'bold': symbol = '*'; break;
        case 'italic': symbol = '_'; break;
        case 'strike': symbol = '~'; break;
        case 'mono': symbol = '```'; break;
    }
    
    // Wrap the selected text
    const newText = fullText.substring(0, start) + symbol + selectedText + symbol + fullText.substring(end);
    
    textarea.value = newText;
    
    // Restore selection (including symbols) so user sees what happened
    textarea.focus();
    textarea.setSelectionRange(start, end + (symbol.length * 2));
}
// --- RICH EDITOR LOGIC ---

// 1. Markdown to HTML Converter (For opening Editor)
// Converts *text* to <b>text</b> so symbols hide
function markdownToHtml(text) {
    let html = text
        .replace(/\*(.*?)\*/g, '<b>$1</b>')         // Bold
        .replace(/_(.*?)_/g, '<i>$1</i>')           // Italic
        .replace(/~(.*?)~/g, '<s>$1</s>')           // Strikethrough
        .replace(/```(.*?)```/g, '<tt>$1</tt>')     // Monospace
        .replace(/\n/g, '<br>');                    // Newlines
    return html;
}

// 2. HTML to Markdown Converter (For Closing/Sending)
// Converts <b>text</b> back to *text* for the backend
function htmlToMarkdown(html) {
    // Temporary Div to parse HTML
    let temp = document.createElement("div");
    temp.innerHTML = html;

    // Convert styles back to symbols
    let text = temp.innerHTML
        .replace(/<br>/g, '\n')
        .replace(/<div>/g, '\n')       // ContentEditable often adds divs for new lines
        .replace(/<\/div>/g, '')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<strong>(.*?)<\/strong>/g, '*$1*')
        .replace(/<i>(.*?)<\/i>/g, '_$1_')
        .replace(/<em>(.*?)<\/em>/g, '_$1_')
        .replace(/<s>(.*?)<\/s>/g, '~$1~')
        .replace(/<strike>(.*?)<\/strike>/g, '~$1~')
        .replace(/<tt>(.*?)<\/tt>/g, '```$1```');

    // Clean up HTML tags leaving plain text + markdown symbols
    temp.innerHTML = text; 
    return temp.innerText; 
}

// 3. Open Expanded Editor
function openExpandedEditor() {
    const smallInput = document.getElementById('msg-input');
    const richInput = document.getElementById('editor-input-rich');
    
    // Convert plain markdown text to visual HTML
    richInput.innerHTML = markdownToHtml(smallInput.value);
    
    document.getElementById('view-editor-mode').classList.add('active');
}

// 4. Shrink / Close Editor
function closeExpandedEditor() {
    const smallInput = document.getElementById('msg-input');
    const richInput = document.getElementById('editor-input-rich');
    
    // Convert visual HTML back to markdown
    smallInput.value = htmlToMarkdown(richInput.innerHTML);
    
    document.getElementById('view-editor-mode').classList.remove('active');
    
    // Trigger Resize logic again
    autoResizeTextarea();
    smallInput.focus();
}

// 5. Apply Formatting (The WYSIWYG part)
function applyRichFormat(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('editor-input-rich').focus();
}

// 6. Send directly from Editor
function sendFromEditor() {
    const richInput = document.getElementById('editor-input-rich');
    const smallInput = document.getElementById('msg-input');
    
    // Sync data
    smallInput.value = htmlToMarkdown(richInput.innerHTML);
    
    // Close modal
    document.getElementById('view-editor-mode').classList.remove('active');
    
    // Send
    sendMessage();
}
// --- FORMATTING PARSER (DISPLAY LOGIC) ---
function parseAndFormatMessage(text) {
    if (!text) return "";

    // HTML elements ko sanitize karein
    let cleanText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // formatting rules
    cleanText = cleanText
        // 1. Bold: Sabse pehla '*' aur aakhri '*' ke beech ka sab kuch bold hoga
        // Isme humne (.*) use kiya hai jo beech ke baaki '*' ko bhi text ki tarah bold kar dega
        .replace(/\*(.*)\*/g, '<b class="fmt-bold">$1</b>')

        // 2. Strikethrough: Sabse pehle '~' aur aakhri '~' ke beech ka content
        .replace(/~(.*)~/g, '<s class="fmt-strike">$1</s>')

        // 3. Italic: Sabse pehle '_' aur aakhri '_' ke beech ka content
        .replace(/_(.*)_/g, '<i class="fmt-italic">$1</i>')

        // Line breaks
        .replace(/\n/g, '<br>');

    return cleanText;
}

function scrollToBottomSmooth() {
    const container = document.getElementById('messages-container');
    container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
    });
}
// --- TOGGLE READ MORE / LESS ---
// --- TOGGLE READ MORE / LESS (Fixed No Scroll Jump) ---
function toggleReadMore(msgId, event) {
    // બબલ ક્લિક ઇવેન્ટ રોકવા માટે
    if (event) event.stopPropagation();

    const container = document.getElementById('messages-container');
    const textContainer = document.getElementById(`text-content-${msgId}`);
    const btnMore = document.getElementById(`btn-more-${msgId}`);
    const btnLess = document.getElementById(`btn-less-${msgId}`);

    // 🔥 STEP 1: હાલનું સ્ક્રોલ પોઝિશન સેવ કરો
    // જ્યારે મેસેજ ખૂલે ત્યારે બ્રાઉઝર ઓટોમેટિક સ્ક્રોલ ન કરે તે માટે આ જરૂરી છે.
    const currentScrollTop = container.scrollTop;

    const isCollapsed = textContainer.classList.contains('collapsed');

    if (isCollapsed) {
        // Expand (ખોલો)
        textContainer.classList.remove('collapsed');
        btnMore.style.display = 'none';
        btnLess.style.display = 'inline-block';
    } else {
        // Collapse (બંધ કરો)
        textContainer.classList.add('collapsed');
        btnMore.style.display = 'inline-block';
        btnLess.style.display = 'none';
    }

    // 🔥 STEP 2: સ્ક્રોલ પોઝિશન રિસ્ટોર કરો
    // આનાથી મેસેજ નીચે તરફ ખુલશે પણ તમારી સ્ક્રીન ત્યાંની ત્યાં જ રહેશે.
    container.scrollTop = currentScrollTop;
}
// --- 1. SMART FILE HELPER (Fixes Unknown File Issue) ---
function getFileMetaInfo(fileName, url) {
    // જો ડેટાબેઝમાં નામ ન હોય, તો URL માંથી નામ કાઢો
    if (!fileName || fileName === 'file' || fileName === 'Unknown File') {
        if (url) {
            try {
                // Cloudinary URL માંથી છેલ્લો ભાગ (filename.ext) લેવો
                const decodedUrl = decodeURIComponent(url);
                fileName = decodedUrl.split('/').pop().split('?')[0]; 
                // નામ બહુ લાંબુ હોય અને રેન્ડમ નંબરો હોય તો સાફ કરવું
                if (fileName.length > 20) fileName = fileName.substring(fileName.length - 15);
            } catch (e) {
                fileName = "Document";
            }
        } else {
            fileName = "Document";
        }
    }

    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'file';
    
    let icon = 'description';
    let colorClass = 'f-color-def';
    let typeName = ext.toUpperCase();

    // COLOR & ICON MAPPING
    if (['pdf'].includes(ext)) {
        icon = 'picture_as_pdf'; colorClass = 'f-color-pdf';
    } 
    else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
        icon = 'article'; colorClass = 'f-color-doc';
    } 
    else if (['xls', 'xlsx', 'csv', 'sheets'].includes(ext)) {
        icon = 'table_view'; colorClass = 'f-color-xls';
    } 
    else if (['ppt', 'pptx', 'slides'].includes(ext)) {
        icon = 'slideshow'; colorClass = 'f-color-ppt';
    } 
    else if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
        icon = 'folder_zip'; colorClass = 'f-color-zip';
    } 
    else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
        icon = 'audio_file'; colorClass = 'f-color-music';
    }
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        icon = 'image'; colorClass = 'f-color-doc'; // Image as file
    }
    else if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
        icon = 'movie'; colorClass = 'f-color-ppt'; // Video as file
    }

    return { icon, colorClass, typeName, cleanName: fileName };
}

function formatBytes(bytes, decimals = 1) {
    if (!bytes || isNaN(bytes)) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + sizes[i];
}

// --- 2. BOTTOM SHEET ACTIONS ---
let currentFileData = {};

function openFileSheet(url, name, size) {
    // સ્માર્ટ હેલ્પરનો ઉપયોગ કરીને નામ અને આઈકોન મેળવો
    const meta = getFileMetaInfo(name, url);
    const sizeStr = formatBytes(size);
    
    currentFileData = { url, name: meta.cleanName };

    // Update UI
    document.getElementById('sheet-filename').innerText = meta.cleanName;
    document.getElementById('sheet-filesize').innerText = sizeStr ? `${sizeStr} • ${meta.typeName}` : meta.typeName;
    
    const iconContainer = document.getElementById('sheet-file-icon');
    iconContainer.className = `sheet-icon-large ${meta.colorClass}`;
    iconContainer.innerHTML = `<span class="material-icons-round">${meta.icon}</span>`;

    // Show Sheet
    document.getElementById('file-sheet-backdrop').classList.add('active');
    document.getElementById('file-action-sheet').classList.add('active');
}

function closeFileSheet() {
    document.getElementById('file-sheet-backdrop').classList.remove('active');
    document.getElementById('file-action-sheet').classList.remove('active');
}

function downloadCurrentFile() {
    const a = document.createElement('a');
    a.href = currentFileData.url;
    a.download = currentFileData.name;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    closeFileSheet();
}

async function shareCurrentFile() {
    if (navigator.share) {
        try {
            await navigator.share({
                title: currentFileData.name,
                url: currentFileData.url
            });
        } catch (e) { console.log('Share error', e); }
    } else {
        // Fallback: Copy Link
        navigator.clipboard.writeText(currentFileData.url);
        alert('Link copied to clipboard!');
    }
    closeFileSheet();
}
function isScrolledToBottom() {
    const container = document.getElementById('messages-container');
    return container.scrollHeight - container.scrollTop - container.clientHeight < 20;
}
const msgContainer = document.getElementById('messages-container');

msgContainer.addEventListener('scroll', () => {
    if (
        currentChatId &&
        document.visibilityState === "visible" &&
        isScrolledToBottom()
    ) {
        markMessagesAsRead(currentChatId);
    }
});
document.addEventListener("visibilitychange", () => {
    if (
        document.visibilityState === "visible" &&
        currentChatId &&
        isScrolledToBottom()
    ) {
        markMessagesAsRead(currentChatId);
    }
});
function handleInput(el) {
    const display = document.getElementById('input-highlight');
    let text = el.value;

    // Formatting Logic (Regex)
    // 1. Bold: *text*
    text = text.replace(/\*(.*?)\*/g, '<span class="syntax-gray">*</span><span class="format-bold">$1</span><span class="syntax-gray">*</span>');
    
    // 2. Italic: _text_
    text = text.replace(/_(.*?)_/g, '<span class="syntax-gray">_</span><span class="format-italic">$1</span><span class="syntax-gray">_</span>');
    
    // 3. Strike: ~text~
    text = text.replace(/~(.*?)~/g, '<span class="syntax-gray">~</span><span class="format-strike">$1</span><span class="syntax-gray">~</span>');
    
    // 4. Code: ```text```
    text = text.replace(/```(.*?)```/gs, '<span class="syntax-gray">```</span><span class="format-code">$1</span><span class="syntax-gray">```</span>');

    // Display update
    display.innerHTML = text.replace(/\n/g, '<br>'); // New line handling
    
    // Auto-resize height
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    display.style.height = el.scrollHeight + 'px';
}

// Scroll sync karne ke liye (agar text lamba ho jaye)
function syncScroll(el) {
    const display = document.getElementById('input-highlight');
    display.scrollTop = el.scrollTop;
}
// --- CHAT INFO / PROFILE LOGIC ---

function openChatInfo() {
    if (!currentChatId) return;
    const contact = getContact(currentChatId);
    if (!contact) return;

    // 1. Populate Header Data
    const imgEl = document.getElementById('ci-avatar');
    const noImgEl = document.getElementById('ci-no-avatar');
    const nameEl = document.getElementById('ci-name');
    const idEl = document.getElementById('ci-id');

    nameEl.innerText = contact.nickname || contact.name || "User";
    idEl.innerText = `ID: ${contact.id}`;

    if (contact.avatar) {
        imgEl.src = contact.avatar;
        imgEl.style.display = 'block';
        noImgEl.style.display = 'none';
        // Click to view avatar full screen
        imgEl.onclick = () => openMediaViewer(contact.avatar, 'image', nameEl.innerText);
    } else {
        imgEl.style.display = 'none';
        noImgEl.style.display = 'flex';
        noImgEl.innerText = (contact.nickname || contact.name || "U").charAt(0).toUpperCase();
    }

    // 2. Filter & Render History
    renderChatInfoMedia(contact.history);
    renderChatInfoDocs(contact.history);
    renderChatInfoLinks(contact.history);

    // 3. Reset Tab to Media & Show View
    switchInfoTab('media');
    
    // Slide In Animation
    const view = document.getElementById('view-chat-info');
    view.classList.add('active');
    setTimeout(() => {
        view.style.transform = "translateX(0)";
    }, 10);
}

function closeChatInfo() {
    const view = document.getElementById('view-chat-info');
    view.style.transform = "translateX(100%)";
    setTimeout(() => {
        view.classList.remove('active');
    }, 300);
}

function switchInfoTab(tabName) {
    // 1. Update Buttons
    document.querySelectorAll('.ci-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.ci-tab[onclick="switchInfoTab('${tabName}')"]`).classList.add('active');

    // 2. Show Section
    document.querySelectorAll('.ci-tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-content-${tabName}`).classList.add('active');
}

// --- RENDER HELPERS ---

function renderChatInfoMedia(history) {
    const grid = document.getElementById('ci-media-grid');
    // Filter Images & Videos
    const media = history.filter(m => m.type === 'image' || m.type === 'video').reverse(); // Newest first

    if (media.length === 0) {
        grid.innerHTML = '<div class="ci-empty" style="grid-column: 1/-1;">No media shared</div>';
        return;
    }

    grid.innerHTML = media.map(m => {
        if (m.type === 'image') {
            return `<div class="ci-media-item" onclick="openMediaViewer('${m.content}', 'image', '${m.fileName || 'Image'}')">
                        <img src="${m.content}" loading="lazy">
                    </div>`;
        } else {
            return `<div class="ci-media-item" onclick="openMediaViewer('${m.content}', 'video', '${m.fileName || 'Video'}')">
                        <video src="${m.content}#t=0.5"></video>
                        <span class="material-icons-round ci-play-icon">play_circle_filled</span>
                    </div>`;
        }
    }).join('');
}

function renderChatInfoDocs(history) {
    const list = document.getElementById('ci-docs-list');
    // Filter Files & Audio
    const docs = history.filter(m => m.type === 'file' || m.type === 'audio').reverse();

    if (docs.length === 0) {
        list.innerHTML = '<div class="ci-empty">No documents shared</div>';
        return;
    }

    list.innerHTML = docs.map(m => {
        const meta = getFileMetaInfo(m.fileName, m.content);
        const size = formatBytes(m.fileSize || 0);
        const date = new Date(m.timestamp).toLocaleDateString();

        return `<div class="ci-list-item" onclick="openFileSheet('${m.content}', '${meta.cleanName}', ${m.fileSize || 0})">
                    <div class="ci-icon-box ${meta.colorClass}">
                        <span class="material-icons-round">${meta.icon}</span>
                    </div>
                    <div class="ci-content">
                        <span class="ci-title">${meta.cleanName}</span>
                        <span class="ci-sub">${size} • ${date}</span>
                    </div>
                </div>`;
    }).join('');
}

function renderChatInfoLinks(history) {
    const list = document.getElementById('ci-links-list');
    
    // Find text messages containing URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links = [];

    // Reverse loop to get newest first
    for (let i = history.length - 1; i >= 0; i--) {
        const m = history[i];
        if (m.type === 'text') {
            const found = m.content.match(urlRegex);
            if (found) {
                found.forEach(url => {
                    links.push({ url: url, timestamp: m.timestamp });
                });
            }
        }
    }

    if (links.length === 0) {
        list.innerHTML = '<div class="ci-empty">No links shared</div>';
        return;
    }

    list.innerHTML = links.map(l => {
        const date = new Date(l.timestamp).toLocaleDateString();
        return `<div class="ci-list-item" onclick="window.open('${l.url}', '_blank')">
                    <div class="ci-icon-box" style="background: #E3F2FD; color: #1976D2;">
                        <span class="material-icons-round">link</span>
                    </div>
                    <div class="ci-content">
                        <span class="ci-title" style="color:#1976D2;">${l.url}</span>
                        <span class="ci-sub">${date}</span>
                    </div>
                </div>`;
    }).join('');
}

// Run
init();
