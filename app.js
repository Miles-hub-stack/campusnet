// Simple feed logic: create posts, like, comment with persistence
const feed = document.getElementById('feed');
const postBtn = document.getElementById('postBtn');
const postText = document.getElementById('postText');
const mediaFile = document.getElementById('mediaFile');
const mediaPreview = document.getElementById('mediaPreview');
const charCount = document.getElementById('charCount');
const template = document.getElementById('postTemplate');
const logoutBtn = document.getElementById('logoutBtn');
const profileLink = document.getElementById('profileLink');

function getCurrentUser(){ try{ return localStorage.getItem('user'); }catch(e){ return null; } }
function getProfile(username){ try{ const u = localStorage.getItem('profile:' + username); return u? JSON.parse(u): {name:username, avatar:'https://via.placeholder.com/48', bio:''}; }catch(e){ return {name:username, avatar:'https://via.placeholder.com/48', bio:''}; } }
let currentUser = getCurrentUser();
if(currentUser && profileLink){ profileLink.href = 'profile.html'; }
// Show admin link only for System user
try{
  const adminLink = document.getElementById('adminLink');
  if(adminLink){
    if(currentUser === 'System') adminLink.style.display = '';
    else adminLink.style.display = 'none';
  }
}catch(e){}

// If Supabase is available, try to get the authenticated user and sync username
(async function syncSupabaseUser(){
  if(window.SocialSupabase){
    try{
      const u = await SocialSupabase.getUser();
      const sup = u.data?.user;
      if(sup){
        const uname = sup.user_metadata?.username || (sup.email ? sup.email.split('@')[0] : null);
        if(uname){ currentUser = uname; try{ localStorage.setItem('user', uname); }catch(e){} }
        if(profileLink) profileLink.href = 'profile.html';
        // show admin link if System
        try{ const adminLink = document.getElementById('adminLink'); if(adminLink){ adminLink.style.display = (uname === 'System') ? '' : 'none'; } }catch(e){}
      }
    }catch(e){ /* ignore */ }
  }
})();

function createPostElement(post){
  const node = template.content.cloneNode(true);
  // author/profile
  const author = post.author || 'Anonymous';
  const meta = getProfile(author);
  node.querySelector('.name').textContent = (meta && meta.name) ? meta.name : author;
  node.querySelector('.avatar').src = (meta && meta.avatar) ? meta.avatar : 'https://via.placeholder.com/48';
  // body text
  const body = node.querySelector('.post-body');
  body.textContent = post.text || '';
  // time
  const timeEl = node.querySelector('.time'); if(timeEl) timeEl.textContent = post.time ? new Date(post.time).toLocaleString() : new Date().toLocaleString();
  // likes/comments placeholders
  node.querySelector('.likes').textContent = (post.likedUsers && post.likedUsers.length) || post.likes || 0;
  node.querySelector('.comments').textContent = (post.comments && post.comments.length) || 0;

  // render media (if any)
  if(post.media){
    try{
      const isData = post.media.indexOf('data:') === 0;
      const lower = post.media.toLowerCase();
      if(isData){
        if(post.media.indexOf('video')>-1){ const vid = document.createElement('video'); vid.src = post.media; vid.controls = true; vid.style.maxWidth = '100%'; vid.style.borderRadius='8px'; body.appendChild(vid); }
        else { const img = document.createElement('img'); img.src = post.media; img.alt='media'; img.style.maxWidth='100%'; img.style.borderRadius='8px'; body.appendChild(img); }
      } else if(lower.endsWith('.mp4') || lower.includes('youtube') || lower.includes('vimeo')){
        const vid = document.createElement('video'); vid.src = post.media; vid.controls = true; vid.style.maxWidth = '100%'; vid.style.borderRadius='8px'; body.appendChild(vid);
      } else {
        const img = document.createElement('img'); img.src = post.media; img.alt='media'; img.style.maxWidth='100%'; img.style.borderRadius='8px'; body.appendChild(img);
      }
    }catch(e){ /* ignore */ }
  }

  // comments list container
  const commentsList = document.createElement('div'); commentsList.className = 'comments-list';
  commentsList.style.marginTop = '10px';
  if(post.comments && post.comments.length){
    post.comments.forEach(c=>{
      const el = document.createElement('div'); el.className = 'comment-item';
      el.style.padding = '6px 8px'; el.style.borderTop = '1px solid #f1f5f9';
      el.innerHTML = `<strong style="font-size:0.95rem">${(c.author||'Anon')}</strong> <span style="color:#718096;font-size:0.85rem;margin-left:8px">${new Date(c.time).toLocaleString()}</span><div style="margin-top:6px">${c.text}</div>`;
      commentsList.appendChild(el);
    });
  }
  node.querySelector('article').appendChild(commentsList);

  return node;
}

postBtn.addEventListener('click', async ()=>{
  const v = postText.value.trim();
  if(!v) return;
  const mediaFromFile = mediaFile && mediaFile._dataUrl ? mediaFile._dataUrl : null;
  const media = mediaFromFile || null;
  const post = {
    id: 'p_' + Date.now(),
    author: currentUser,
    text: v,
    media: media || null,
    likes: 0,
    likedUsers: [],
    comments: [],
    time: new Date().toISOString()
  };
  // try server save via Supabase, fallback to localStorage
  try{
    if(window.SocialSupabase){
      const res = await SocialSupabase.addPost({ text: post.text, media: post.media });
      if(res.error){ throw res.error; }
      // refresh feed from server
      await renderPosts();
    } else {
      savePost(post);
      renderPosts();
    }
  }catch(e){ console.warn('Server post failed, saving locally', e); savePost(post); renderPosts(); }
  postText.value = '';
  charCount.textContent = 0;
  if(mediaFile){ mediaFile.value = ''; mediaFile._dataUrl = null; mediaPreview.innerHTML = ''; }
});

postText.addEventListener('input', ()=>{
  charCount.textContent = postText.value.length;
});

// File input -> data URL preview
if(mediaFile){
  mediaFile.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f){ mediaFile._dataUrl = null; mediaPreview.innerHTML = ''; return; }
    const reader = new FileReader();
    reader.onload = function(ev){
      const data = ev.target.result;
      mediaFile._dataUrl = data;
      // show preview
      mediaPreview.innerHTML = '';
      if(f.type.includes('video')){
        const v = document.createElement('video'); v.src = data; v.controls = true; v.style.maxWidth='100%'; v.style.borderRadius='8px'; mediaPreview.appendChild(v);
      }else{
        const img = document.createElement('img'); img.src = data; img.style.maxWidth='100%'; img.style.borderRadius='8px'; mediaPreview.appendChild(img);
      }
    };
    reader.readAsDataURL(f);
  });
}

// sample initial posts
// Persistence: load/save posts
function loadPosts(){ try{ const p = localStorage.getItem('posts'); return p? JSON.parse(p): []; }catch(e){ return []; } }
function saveAllPosts(arr){ try{ localStorage.setItem('posts', JSON.stringify(arr)); }catch(e){} }
function savePost(post){ const arr = loadPosts(); arr.unshift(post); saveAllPosts(arr); }

// Render posts: prefer Supabase.fetchPosts() when available, otherwise use localStorage
async function renderPosts(){
  feed.innerHTML = '';
  let postsArr = [];
  if(window.SocialSupabase){
    try{
      const resp = await SocialSupabase.fetchPosts();
      if(resp.error) throw resp.error;
      // map server rows to local post shape
      postsArr = (resp.data || []).map(r=>({
        id: r.id || ('p_' + (new Date(r.created_at).getTime())),
        author: r.author_username || r.author || 'unknown',
        text: r.text || '',
        media: r.media || null,
        likedUsers: [],
        comments: [],
        time: r.created_at || new Date().toISOString()
      }));
    }catch(e){ console.warn('Failed to fetch posts from Supabase', e); postsArr = loadPosts(); }
  } else {
    postsArr = loadPosts();
  }

  if(postsArr.length===0){
    const samples = [
      {id:'s1',author:'System',text:'Welcome to MySocial — this is a responsive demo feed!',media:null,likes:0,comments:[],time:new Date().toISOString()},
      {id:'s2',author:'System',text:'Try creating a post, liking, or adding a comment.',media:null,likes:0,comments:[],time:new Date().toISOString()}
    ];
    samples.forEach(p=> savePost(p));
  }

  // ensure System profile uses CampusNet.png as avatar
  try{
    const profiles = JSON.parse(localStorage.getItem('profiles')||'{}');
    profiles['System'] = profiles['System'] || {name:'System', avatar:'CampusNet.png', bio:''};
    profiles['System'].avatar = 'CampusNet.png';
    localStorage.setItem('profiles', JSON.stringify(profiles));
    localStorage.setItem('profile:System', JSON.stringify(profiles['System']));
  }catch(e){}

  postsArr.forEach(post=>{
    if(!Array.isArray(post.likedUsers)) post.likedUsers = [];
    const node = createPostElement(post);
    // attach likes/comments and actions (same as prior code)
    const likesEl = node.querySelector('.likes');
    const likeBtn = node.querySelector('.like-btn');
    const likedCount = post.likedUsers.length || post.likes || 0;
    likesEl.textContent = likedCount;
    if(currentUser && post.likedUsers.indexOf(currentUser) > -1){ likeBtn.classList.add('liked'); } else { likeBtn.classList.remove('liked'); }
    const commentsEl = node.querySelector('.comments'); commentsEl.textContent = (post.comments||[]).length;

    const likeButton = node.querySelector('.like-btn');
    likeButton.addEventListener('click', ()=>{
      if(!currentUser) return alert('Sign in to like posts');
      // local-like only for now; server-side like handling not implemented yet
      const posts = loadPosts(); const idx = posts.findIndex(p=>p.id===post.id);
      if(idx>-1){
        const uidx = posts[idx].likedUsers ? posts[idx].likedUsers.indexOf(currentUser) : -1;
        if(uidx > -1){ posts[idx].likedUsers.splice(uidx,1); } else { posts[idx].likedUsers = posts[idx].likedUsers || []; posts[idx].likedUsers.push(currentUser); }
        posts[idx].likes = posts[idx].likedUsers.length;
        saveAllPosts(posts);
        renderPosts();
      }
    });

    const commentBtn = node.querySelector('.comment-btn');
    const commentArea = node.querySelector('.comment-area');
    const submitComment = node.querySelector('.submit-comment');
    const commentInput = node.querySelector('.comment-input');
    commentBtn.addEventListener('click', ()=> commentArea.classList.toggle('hidden'));
    submitComment.addEventListener('click', ()=>{
      const v = commentInput.value.trim(); if(!v) return; const posts = loadPosts(); const idx = posts.findIndex(p=>p.id===post.id); if(idx>-1){ posts[idx].comments = posts[idx].comments || []; posts[idx].comments.push({author:currentUser,text:v,time:new Date().toISOString()}); saveAllPosts(posts); renderPosts(); }
    });

    const footer = node.querySelector('.post-footer');
    if(footer){
      const del = document.createElement('button'); del.className = 'action delete-btn'; del.textContent = 'Delete';
      del.style.marginLeft = 'auto';
      if(post.author !== currentUser) del.style.display = 'none';
      del.addEventListener('click', ()=>{
        if(!confirm('Delete this post?')) return;
        const posts = loadPosts().filter(p=>p.id !== post.id);
        saveAllPosts(posts);
        renderPosts();
      });
      footer.appendChild(del);
    }

    feed.appendChild(node);
  });
}

renderPosts();

// Logout handler
if(logoutBtn){
  logoutBtn.addEventListener('click', async ()=>{
    try{ if(window.SocialSupabase){ await SocialSupabase.logout(); } localStorage.removeItem('user'); }catch(e){}
    window.location.href = 'login.html';
  });
}
