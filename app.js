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
      // update create UI based on sup auth
      updateCreateUI(Boolean(sup));
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

// Update create-post UI based on authentication state
function updateCreateUI(isAuthenticated){
  try{
    if(!postText || !postBtn) return;
    postText.disabled = !isAuthenticated;
    postBtn.disabled = !isAuthenticated;
    if(mediaFile) mediaFile.disabled = !isAuthenticated;
    // show a sign-in hint when not authenticated
    let hint = document.getElementById('authHint');
    if(!isAuthenticated){
      if(!hint){
        hint = document.createElement('div');
        hint.id = 'authHint';
        hint.style.padding = '10px 12px';
        hint.style.marginBottom = '8px';
        hint.style.background = '#fffbeb';
        hint.style.border = '1px solid #fef3c7';
        hint.style.borderRadius = '8px';
        hint.style.color = '#92400e';
        hint.innerHTML = 'Sign in to create posts — <a href="login.html">Sign in</a>';
        const createSection = document.querySelector('.create-post');
        if(createSection) createSection.insertBefore(hint, createSection.firstChild);
      }
    } else {
      if(hint && hint.parentNode) hint.parentNode.removeChild(hint);
    }
  }catch(e){ console.warn('Could not update create UI', e); }
}

// initialize UI state (assume unauthenticated until sync finishes)
updateCreateUI(false);

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
  // Save post to Supabase (no localStorage fallback)
  try{
    if(window.SocialSupabase){
      // ensure the user is authenticated with Supabase before attempting insert
      const uresp = await SocialSupabase.getUser();
      const supUser = uresp.data?.user;
      if(!supUser){ alert('Please sign in to create a post.'); return; }
      const res = await SocialSupabase.addPost({ content: post.text });
      if(res.error){
        console.error('Add post error', res.error);
        const msg = res.error.message || (typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
        alert('Could not save post: ' + msg);
        return;
      }
      await renderPosts();
    } else {
      throw new Error('Supabase client unavailable');
    }
  }catch(e){ console.error('Failed to save post to server', e); alert('Could not save post'); }
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
// Render posts exclusively from Supabase (no localStorage persistence for posts)
async function renderPosts(){
  feed.innerHTML = '';
  let postsArr = [];
  try{
    const resp = await SocialSupabase.fetchPosts();
    if(resp.error) throw resp.error;
    const profilesResp = await SocialSupabase.getAllProfiles();
    const profiles = (profilesResp.data || []).reduce((m, p)=>{ m[p.id] = p; m[p.username] = p; return m; }, {});
    postsArr = (resp.data || []).map(r=>({
      id: r.id,
      author: (profiles[r.user_id] && profiles[r.user_id].username) || (profiles[r.user_id] && profiles[r.user_id].name) || r.user_id,
      text: r.content || '',
      media: null,
      likedUsers: [],
      comments: [],
      time: r.created_at || new Date().toISOString()
    }));
  }catch(e){
    console.error('Failed to load posts from Supabase', e);
    feed.innerHTML = '<div style="padding:20px;color:#666">Unable to load feed.</div>';
    return;
  }

  // ensure System profile uses CampusNet.png locally (keeps avatar behavior)
  try{ const localProfiles = JSON.parse(localStorage.getItem('profiles')||'{}'); localProfiles['System'] = localProfiles['System'] || {name:'System', avatar:'CampusNet.png', bio:''}; localProfiles['System'].avatar = 'CampusNet.png'; localStorage.setItem('profiles', JSON.stringify(localProfiles)); localStorage.setItem('profile:System', JSON.stringify(localProfiles['System'])); }catch(e){}

  postsArr.forEach(post=>{
    if(!Array.isArray(post.likedUsers)) post.likedUsers = [];
    const node = createPostElement(post);
    const likesEl = node.querySelector('.likes');
    const likeBtn = node.querySelector('.like-btn');
    likesEl.textContent = (post.likedUsers && post.likedUsers.length) || 0;
    if(currentUser && post.likedUsers.indexOf(currentUser) > -1) likeBtn.classList.add('liked');
    const commentsEl = node.querySelector('.comments'); commentsEl.textContent = (post.comments||[]).length;

    // Like button: client-only behavior until server-side likes implemented
    likeBtn.addEventListener('click', ()=>{
      if(!currentUser) return alert('Sign in to like posts');
      if(!post.likedUsers) post.likedUsers = [];
      const i = post.likedUsers.indexOf(currentUser);
      if(i>-1) post.likedUsers.splice(i,1); else post.likedUsers.push(currentUser);
      likesEl.textContent = post.likedUsers.length;
      likeBtn.classList.toggle('liked');
    });

    const commentBtn = node.querySelector('.comment-btn');
    const commentArea = node.querySelector('.comment-area');
    const submitComment = node.querySelector('.submit-comment');
    const commentInput = node.querySelector('.comment-input');
    commentBtn.addEventListener('click', ()=> commentArea.classList.toggle('hidden'));
    submitComment.addEventListener('click', ()=>{
      const v = commentInput.value.trim(); if(!v) return; post.comments = post.comments || []; post.comments.push({ author: currentUser, text: v, time: new Date().toISOString() }); commentsEl.textContent = post.comments.length; commentInput.value = '';
    });

    const footer = node.querySelector('.post-footer');
    if(footer){
      const del = document.createElement('button'); del.className = 'action delete-btn'; del.textContent = 'Delete'; del.style.marginLeft = 'auto';
      if(post.author !== currentUser) del.style.display = 'none';
      del.addEventListener('click', async ()=>{
        if(!confirm('Delete this post?')) return;
        try{
          await SocialSupabase.deletePostById(post.id);
          await renderPosts();
        }catch(e){ console.error('Failed to delete post', e); alert('Could not delete post'); }
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
