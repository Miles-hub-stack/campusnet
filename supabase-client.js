/*
  supabase-client.js
  Lightweight wrapper to load Supabase UMD and expose simple functions for:
  - init (auto)
  - register(email,password,username)
  - login(email,password)
  - logout()
  - addPost({content})  // expects a `posts` table (see notes)
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
    - id (uuid or serial primary key)
    - content (text)
    - user_id (uuid) -- references auth.users(id)
    - created_at (timestamp with time zone default now())
  - For older browsers: include meta tags in your HTML head:
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
*/
(function (window) {
  const SUPABASE_URL = "https://qvfjmvyoehfdvcatgoog.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TacHa4H2IyQbEMwCaLNkhg_oqGrAo3T";
  let _sb = null;
  let _ready = false;
  let _queue = [];

  function _loadSupabase(done) {
    if (window.supabase) {
      _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      _ready = true;
      return done();
    }
    const s = document.createElement("script");
    s.src =
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js";
    s.onload = function () {
      try {
        _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        _ready = true;
      } catch (e) {
        console.error("Supabase init error", e);
      }
      done();
    };
    s.onerror = function (e) {
      console.error("Failed to load Supabase library", e);
      done(e);
    };
    document.head.appendChild(s);
  }

  function _enqueue(fn) {
    if (_ready) fn();
    else _queue.push(fn);
  }
  function _runQueue() {
    while (_queue.length) {
      try {
        const f = _queue.shift();
        f();
      } catch (e) {
        console.error(e);
      }
    }
  }

  _loadSupabase(function (err) {
    if (!err) _runQueue();
  });

  const API = {
    getClient() {
      return _sb;
    },
    async register(email, password, username, profile = {}) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            // sign up with metadata and redirectTo for production
            const { data, error } = await _sb.auth.signUp(
              { email, password },
              {
                redirectTo: "https://tiny-chaja-0c32c9.netlify.app/login.html",
                data: { username },
              },
            );
            if (error) return resolve({ error });
            // optionally create or update a profile record in "profiles" table if you have one
            try {
              const profileRow = {
                id: data.user?.id || null,
                username,
                name: profile.name || username,
                avatar_url: profile.avatar || null,
                bio: profile.bio || null,
              };
              await _sb.from("profiles").upsert(profileRow);
            } catch (e) {
              console.warn("profiles upsert failed", e);
            }
            resolve({ data });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async login(email, password) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb.auth.signInWithPassword({
              email,
              password,
            });
            if (error) return resolve({ error });
            resolve({ data });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async logout() {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { error } = await _sb.auth.signOut();
            resolve({ error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async getUser() {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb.auth.getUser();
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async addPost({ content }) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const userResp = await _sb.auth.getUser();
            const user = userResp.data?.user;
            if (!user) return resolve({ error: "Not authenticated" });
            const user_id = user.id;
            const payload = {
              content,
              user_id,
              created_at: new Date().toISOString(),
            };
            const { data, error } = await _sb.from("posts").insert([payload]);
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async fetchPosts() {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            // fetch posts ordered by newest, including nested likes, comments, and profile data
            const { data, error } = await _sb
              .from("posts")
              .select(
                "id, content, user_id, created_at, profiles(username, avatar_url), likes(user_id), comments(id, user_id, content, created_at)",
              )
              .order("created_at", { ascending: false });
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    // Fallback: simple posts fetch without nested relations (useful if relations not configured)
    async fetchPostsSimple() {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb
              .from("posts")
              .select("id, content, user_id, created_at")
              .order("created_at", { ascending: false });
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async addLike(post_id) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const u = await _sb.auth.getUser();
            const user = u.data?.user;
            if (!user) return resolve({ error: "Not authenticated" });
            const { data, error } = await _sb
              .from("likes")
              .insert([{ post_id, user_id: user.id }]);
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async removeLike(post_id) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const u = await _sb.auth.getUser();
            const user = u.data?.user;
            if (!user) return resolve({ error: "Not authenticated" });
            const { data, error } = await _sb
              .from("likes")
              .delete()
              .match({ post_id, user_id: user.id });
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async addComment(post_id, content) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const u = await _sb.auth.getUser();
            const user = u.data?.user;
            if (!user) return resolve({ error: "Not authenticated" });
            const payload = { post_id, user_id: user.id, content };
            const { data, error } = await _sb
              .from("comments")
              .insert([payload]);
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async fetchComments(post_id) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb
              .from("comments")
              .select("*")
              .eq("post_id", post_id)
              .order("created_at", { ascending: true });
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    // Profiles helpers
    async getProfileByUsername(username) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb
              .from("profiles")
              .select("*")
              .eq("username", username)
              .limit(1)
              .single();
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async getAllProfiles() {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb.from("profiles").select("*");
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async updateProfile(profileRow) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb
              .from("profiles")
              .upsert(profileRow);
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async deleteProfileById(id) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb
              .from("profiles")
              .delete()
              .eq("id", id);
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async deletePostById(id) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb
              .from("posts")
              .delete()
              .eq("id", id);
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    async deletePostsByUser(user_id) {
      return new Promise((resolve) => {
        _enqueue(async () => {
          try {
            const { data, error } = await _sb
              .from("posts")
              .delete()
              .eq("user_id", user_id);
            resolve({ data, error });
          } catch (e) {
            resolve({ error: e });
          }
        });
      });
    },

    redirectBasedOnAuth(home = "home.html", login = "login.html") {
      _enqueue(async () => {
        try {
          const { data } = await _sb.auth.getUser();
          const user = data?.user;
          if (user) {
            if (
              window.location.pathname.endsWith("login.html") ||
              window.location.pathname === "/"
            )
              window.location.href = home;
          } else {
            if (!window.location.pathname.endsWith("login.html"))
              window.location.href = login;
          }
        } catch (e) {
          console.error(e);
        }
      });
    },
  };

  // expose global
  window.SocialSupabase = API;
})(window);
