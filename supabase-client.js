/*
  supabase-client.js
  Lightweight wrapper to load Supabase UMD and expose simple functions for:
  - init (auto)
  - register(email,password,username)
  - login(email,password)
  - logout()
  - addPost({text, media})  // expects a `posts` table (see notes)
  - fetchPosts()
  - getUser()
  - redirectBasedOnAuth(home, login)

  Usage (include after page content or in <head> as regular script):
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js"></script>
  <script src="/supabase-client.js"></script>

  Or just include this file; it will dynamically load the UMD if not already present.

  IMPORTANT: Replace SUPABASE_URL and SUPABASE_KEY with your project values below (already set from your request).

  Notes:
  - This wrapper uses Supabase Auth and the `posts` table. Create a `posts` table with columns:
    - id (uuid or bigint)
    - author_id (text)
    - author_username (text)
    - text (text)
    - media (text) -- URL or data URL
    - created_at (timestamp default now())
  - For older browsers: include meta tags in your HTML head:
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
*/
(function(window){
  const SUPABASE_URL = 'https://qvfjmvyoehfdvcatgoog.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_TacHa4H2IyQbEMwCaLNkhg_oqGrAo3T';
  let _sb = null;
  let _ready = false;
  let _queue = [];

  function _loadSupabase(done){
    if(window.supabase){ _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); _ready = true; return done(); }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js';
    s.onload = function(){
      try{ _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); _ready = true; }catch(e){ console.error('Supabase init error', e); }
      done();
    };
    s.onerror = function(e){ console.error('Failed to load Supabase library', e); done(e); };
    document.head.appendChild(s);
  }

  function _enqueue(fn){ if(_ready) fn(); else _queue.push(fn); }
  function _runQueue(){ while(_queue.length) { try{ const f = _queue.shift(); f(); }catch(e){console.error(e);} } }

  _loadSupabase(function(err){ if(!err) _runQueue(); });

  const API = {
    getClient(){ return _sb; },
    async register(email, password, username, profile = {}){
      return new Promise((resolve)=>{
        _enqueue(async ()=>{
          try{
            // sign up with metadata
            const { data, error } = await _sb.auth.signUp({ email, password }, { data: { username } });
            if(error) return resolve({ error });
            // optionally create or update a profile record in "profiles" table if you have one
            try{
              const profileRow = {
                id: data.user?.id || null,
                username,
                name: profile.name || username,
                avatar: profile.avatar || null,
                bio: profile.bio || null
              };
              await _sb.from('profiles').upsert(profileRow);
            }catch(e){ console.warn('profiles upsert failed', e); }
            resolve({ data });
          }catch(e){ resolve({ error: e }); }
        });
      });
    },

    async login(email, password){
      return new Promise((resolve)=>{
        _enqueue(async ()=>{
          try{
            const { data, error } = await _sb.auth.signInWithPassword({ email, password });
            if(error) return resolve({ error });
            resolve({ data });
          }catch(e){ resolve({ error: e }); }
        });
      });
    },

    async logout(){
      return new Promise((resolve)=>{
        _enqueue(async ()=>{
          try{ const { error } = await _sb.auth.signOut(); resolve({ error }); }catch(e){ resolve({ error: e }); }
        });
      });
    },

    async getUser(){
      return new Promise((resolve)=>{
        _enqueue(async ()=>{
          try{ const { data, error } = await _sb.auth.getUser(); resolve({ data, error }); }catch(e){ resolve({ error: e }); }
        });
      });
    },

    async addPost({ text, media }){
      return new Promise((resolve)=>{
        _enqueue(async ()=>{
          try{
            const userResp = await _sb.auth.getUser();
            const user = userResp.data?.user;
            if(!user) return resolve({ error: 'Not authenticated' });
            const author_id = user.id;
            const author_username = (user.user_metadata && user.user_metadata.username) || user.email || 'unknown';
            const payload = { author_id, author_username, text, media, created_at: new Date().toISOString() };
            const { data, error } = await _sb.from('posts').insert([payload]);
            resolve({ data, error });
          }catch(e){ resolve({ error: e }); }
        });
      });
    },

    async fetchPosts(){
      return new Promise((resolve)=>{
        _enqueue(async ()=>{
          try{
            // fetch posts ordered by newest
            const { data, error } = await _sb.from('posts').select('*').order('created_at', { ascending: false });
            resolve({ data, error });
          }catch(e){ resolve({ error: e }); }
        });
      });
    },

    redirectBasedOnAuth(home = 'home.html', login = 'login.html'){
      _enqueue(async ()=>{
        try{
          const { data } = await _sb.auth.getUser();
          const user = data?.user;
          if(user){ if(window.location.pathname.endsWith('login.html') || window.location.pathname === '/' ) window.location.href = home; }
          else { if(!window.location.pathname.endsWith('login.html')) window.location.href = login; }
        }catch(e){ console.error(e); }
      });
    }
  };

  // expose global
  window.SocialSupabase = API;

})(window);
