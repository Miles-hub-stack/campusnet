// Simple feed logic: create posts, like, comment with persistence
const feed = document.getElementById("feed");
const postBtn = document.getElementById("postBtn");
const postText = document.getElementById("postText");
const mediaFile = document.getElementById("mediaFile");
const mediaPreview = document.getElementById("mediaPreview");
const charCount = document.getElementById("charCount");
const template = document.getElementById("postTemplate");
const logoutBtn = document.getElementById("logoutBtn");
const profileLink = document.getElementById("profileLink");

function getCurrentUser() {
  try {
    return localStorage.getItem("user");
  } catch (e) {
    return null;
  }
}
function getProfile(username) {
  try {
    const u = localStorage.getItem("profile:" + username);
    return u
      ? JSON.parse(u)
      : { name: username, avatar: "https://via.placeholder.com/48", bio: "" };
  } catch (e) {
    return {
      name: username,
      avatar: "https://via.placeholder.com/48",
      bio: "",
    };
  }
}
let currentUser = getCurrentUser();
if (currentUser && profileLink) {
  profileLink.href = "profile.html";
}
// Show admin link only for System user
try {
  const adminLink = document.getElementById("adminLink");
  if (adminLink) {
    if (currentUser === "System") adminLink.style.display = "";
    else adminLink.style.display = "none";
  }
} catch (e) {}

// If Supabase is available, try to get the authenticated user and sync username
(async function syncSupabaseUser() {
  if (window.SocialSupabase) {
    try {
      const u = await SocialSupabase.getUser();
      const sup = u.data?.user;
      // update create UI based on sup auth
      updateCreateUI(Boolean(sup));
      if (sup) {
        const uname =
          sup.user_metadata?.username ||
          (sup.email ? sup.email.split("@")[0] : null);
        if (uname) {
          currentUser = uname;
          try {
            localStorage.setItem("user", uname);
          } catch (e) {}
        }
        if (profileLink) profileLink.href = "profile.html";
        // show admin link if System
        try {
          const adminLink = document.getElementById("adminLink");
          if (adminLink) {
            adminLink.style.display = uname === "System" ? "" : "none";
          }
        } catch (e) {}
      }
    } catch (e) {
      /* ignore */
    }
  }
})();

// Update create-post UI based on authentication state
function updateCreateUI(isAuthenticated) {
  try {
    if (!postText || !postBtn) return;
    postText.disabled = !isAuthenticated;
    postBtn.disabled = !isAuthenticated;
    if (mediaFile) mediaFile.disabled = !isAuthenticated;
    // show a sign-in hint when not authenticated
    let hint = document.getElementById("authHint");
    if (!isAuthenticated) {
      if (!hint) {
        hint = document.createElement("div");
        hint.id = "authHint";
        hint.style.padding = "10px 12px";
        hint.style.marginBottom = "8px";
        hint.style.background = "#fffbeb";
        hint.style.border = "1px solid #fef3c7";
        hint.style.borderRadius = "8px";
        hint.style.color = "#92400e";
        hint.innerHTML =
          'Sign in to create posts — <a href="login.html">Sign in</a>';
        const createSection = document.querySelector(".create-post");
        if (createSection)
          createSection.insertBefore(hint, createSection.firstChild);
      }
    } else {
      if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    }
  } catch (e) {
    console.warn("Could not update create UI", e);
  }
}

// initialize UI state (assume unauthenticated until sync finishes)
updateCreateUI(false);

function createPostElement(post) {
  const node = template.content.cloneNode(true);
  // author/profile using Supabase data directly
  node.querySelector(".name").textContent = post.author;
  node.querySelector(".avatar").src = post.avatar_url || "https://via.placeholder.com/48";
  // body text
  const body = node.querySelector(".post-body");
  body.textContent = post.text || "";
  // time
  const timeEl = node.querySelector(".time");
  if (timeEl)
    timeEl.textContent = post.time
      ? new Date(post.time).toLocaleString()
      : new Date().toLocaleString();
  // likes/comments placeholders
  node.querySelector(".likes").textContent = post.likesCount || 0;
  node.querySelector(".comments").textContent =
    (post.comments && post.comments.length) || 0;

  // render media (if any)
  if (post.media) {
    try {
      const isData = post.media.indexOf("data:") === 0;
      const lower = post.media.toLowerCase();
      if (isData) {
        if (post.media.indexOf("video") > -1) {
          const vid = document.createElement("video");
          vid.src = post.media;
          vid.controls = true;
          vid.style.maxWidth = "100%";
          vid.style.borderRadius = "8px";
          body.appendChild(vid);
        } else {
          const img = document.createElement("img");
          img.src = post.media;
          img.alt = "media";
          img.style.maxWidth = "100%";
          img.style.borderRadius = "8px";
          body.appendChild(img);
        }
      } else if (
        lower.endsWith(".mp4") ||
        lower.includes("youtube") ||
        lower.includes("vimeo")
      ) {
        const vid = document.createElement("video");
        vid.src = post.media;
        vid.controls = true;
        vid.style.maxWidth = "100%";
        vid.style.borderRadius = "8px";
        body.appendChild(vid);
      } else {
        const img = document.createElement("img");
        img.src = post.media;
        img.alt = "media";
        img.style.maxWidth = "100%";
        img.style.borderRadius = "8px";
        body.appendChild(img);
      }
    } catch (e) {
      /* ignore */
    }
  }

  // comments list container
  const commentsList = document.createElement("div");
  commentsList.className = "comments-list";
  commentsList.style.marginTop = "10px";
  if (post.comments && post.comments.length) {
    post.comments.forEach((c) => {
      const el = document.createElement("div");
      el.className = "comment-item";
      el.style.padding = "6px 8px";
      el.style.borderTop = "1px solid #f1f5f9";
      el.innerHTML = `<strong style="font-size:0.95rem">${c.author || "Anon"}</strong> <span style="color:#718096;font-size:0.85rem;margin-left:8px">${new Date(c.time).toLocaleString()}</span><div style="margin-top:6px">${c.text}</div>`;
      commentsList.appendChild(el);
    });
  }
  node.querySelector("article").appendChild(commentsList);

  return node;
}

postBtn.addEventListener("click", async () => {
  const v = postText.value.trim();
  if (!v) return;
  const mediaFromFile =
    mediaFile && mediaFile._dataUrl ? mediaFile._dataUrl : null;
  const media = mediaFromFile || null;
  const post = {
    id: "p_" + Date.now(),
    author: currentUser,
    text: v,
    media: media || null,
    likes: 0,
    likedUsers: [],
    comments: [],
    time: new Date().toISOString(),
  };
  // Save post to Supabase (no localStorage fallback)
  try {
    if (window.SocialSupabase) {
      // ensure the user is authenticated with Supabase before attempting insert
      const uresp = await SocialSupabase.getUser();
      const supUser = uresp.data?.user;
      if (!supUser) {
        alert("Please sign in to create a post.");
        return;
      }
      const res = await SocialSupabase.addPost({ content: post.text });
      if (res.error) {
        console.error("Add post error", res.error);
        const msg =
          res.error.message ||
          (typeof res.error === "string"
            ? res.error
            : JSON.stringify(res.error));
        // Detect missing table schema cache error and give actionable guidance
        if (
          msg.includes(
            "Could not find the table 'public.posts' in the schema cache",
          )
        ) {
          alert(
            "Could not save post: posts table not found in Supabase. Run the SQL schema script (supabase-schema.sql) in your Supabase project SQL editor, then refresh this page.",
          );
          console.error(
            "Run supabase-schema.sql (in project root) in your Supabase SQL editor to create the posts table and RLS policies.",
          );
        } else {
          alert("Could not save post: " + msg);
        }
        return;
      }
      await renderPosts();
    } else {
      throw new Error("Supabase client unavailable");
    }
  } catch (e) {
    console.error("Failed to save post to server", e);
    alert("Could not save post");
  }
  postText.value = "";
  charCount.textContent = 0;
  if (mediaFile) {
    mediaFile.value = "";
    mediaFile._dataUrl = null;
    mediaPreview.innerHTML = "";
  }
});

postText.addEventListener("input", () => {
  charCount.textContent = postText.value.length;
});

// File input -> data URL preview
if (mediaFile) {
  mediaFile.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      mediaFile._dataUrl = null;
      mediaPreview.innerHTML = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
      const data = ev.target.result;
      mediaFile._dataUrl = data;
      // show preview
      mediaPreview.innerHTML = "";
      if (f.type.includes("video")) {
        const v = document.createElement("video");
        v.src = data;
        v.controls = true;
        v.style.maxWidth = "100%";
        v.style.borderRadius = "8px";
        mediaPreview.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.src = data;
        img.style.maxWidth = "100%";
        img.style.borderRadius = "8px";
        mediaPreview.appendChild(img);
      }
    };
    reader.readAsDataURL(f);
  });
}

// sample initial posts
// Persistence: load/save posts
// Render posts exclusively from Supabase (no localStorage persistence for posts)
async function renderPosts() {
  feed.innerHTML = "";
  let postsArr = [];
  // determine current Supabase user id (if signed in) to know liked state
  let supUserId = null;
  try {
    const resp = await SocialSupabase.fetchPosts();
    if (resp.error) throw resp.error;
    const profilesResp = await SocialSupabase.getAllProfiles();
    const profiles = (profilesResp.data || []).reduce((m, p) => {
      m[p.id] = p;
      m[p.username] = p;
      return m;
    }, {});
    try {
      const uresp = await SocialSupabase.getUser();
      supUserId = uresp.data?.user?.id || null;
    } catch (e) {}

    postsArr = (resp.data || []).map((r) => {
      const likes = Array.isArray(r.likes)
        ? r.likes.map((x) => x.user_id || x.userId || x.id)
        : [];
      const comments = Array.isArray(r.comments)
        ? r.comments.map((c) => ({
            author:
              (profiles[c.user_id] && profiles[c.user_id].username) ||
              (profiles[c.user_id] && profiles[c.user_id].name) ||
              c.user_id,
            text: c.content || "",
            time: c.created_at || new Date().toISOString(),
          }))
        : [];
      const profileData = r.profiles && Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        id: r.id,
        author: profileData?.username || (profiles[r.user_id]?.username) || r.user_id,
        avatar_url: profileData?.avatar_url || (profiles[r.user_id]?.avatar_url) || null,
        text: r.content || "",
        media: null,
        likedBy: likes,
        likesCount: likes.length,
        comments: comments,
        time: r.created_at || new Date().toISOString(),
      };
    });
  } catch (e) {
    console.error("Failed to load posts from Supabase", e);
    // Try a simpler fetch without nested relations as a fallback
    try {
      const fb = await SocialSupabase.fetchPostsSimple();
      if (fb.error) throw fb.error;
      const profilesResp = await SocialSupabase.getAllProfiles();
      const profiles = (profilesResp.data || []).reduce((m, p) => {
        m[p.id] = p;
        m[p.username] = p;
        return m;
      }, {});
      try {
        const uresp = await SocialSupabase.getUser();
        supUserId = uresp.data?.user?.id || null;
      } catch (e) {}
      postsArr = (fb.data || []).map((r) => ({
        id: r.id,
        author:
          (profiles[r.user_id] && profiles[r.user_id].username) ||
          (profiles[r.user_id] && profiles[r.user_id].name) ||
          r.user_id,
        avatar_url: (profiles[r.user_id] && profiles[r.user_id].avatar_url) || null,
        text: r.content || "",
        media: null,
        likedBy: [],
        likesCount: 0,
        comments: [],
        time: r.created_at || new Date().toISOString(),
      }));
      // continue to rendering below
    } catch (fbErr) {
      const msg =
        fbErr?.message ||
        (typeof fbErr === "string" ? fbErr : JSON.stringify(fbErr));
      feed.innerHTML = `<div style="padding:20px;color:#666">Unable to load feed: ${msg}</div>`;
      return;
    }
  }

  // ensure System profile uses CampusNet.png locally (keeps avatar behavior)
  try {
    const localProfiles = JSON.parse(localStorage.getItem("profiles") || "{}");
    localProfiles["System"] = localProfiles["System"] || {
      name: "System",
      avatar: "CampusNet.png",
      bio: "",
    };
    localProfiles["System"].avatar = "CampusNet.png";
    localStorage.setItem("profiles", JSON.stringify(localProfiles));
    localStorage.setItem(
      "profile:System",
      JSON.stringify(localProfiles["System"]),
    );
  } catch (e) {}

  postsArr.forEach((post) => {
    const node = createPostElement(post);
    const likesEl = node.querySelector(".likes");
    const likeBtn = node.querySelector(".like-btn");
    likesEl.textContent = post.likesCount || 0;
    if (
      supUserId &&
      Array.isArray(post.likedBy) &&
      post.likedBy.indexOf(supUserId) > -1
    )
      likeBtn.classList.add("liked");
    const commentsEl = node.querySelector(".comments");
    commentsEl.textContent = (post.comments || []).length;

    // Like button: call server API then refresh feed
    likeBtn.addEventListener("click", async () => {
      try {
        const uresp = await SocialSupabase.getUser();
        const sup = uresp.data?.user;
        if (!sup) return alert("Sign in to like posts");
        const isLiked =
          Array.isArray(post.likedBy) &&
          sup.id &&
          post.likedBy.indexOf(sup.id) > -1;
        if (isLiked) {
          const rem = await SocialSupabase.removeLike(post.id);
          if (rem.error) throw rem.error;
        } else {
          const add = await SocialSupabase.addLike(post.id);
          if (add.error) throw add.error;
        }
        await renderPosts();
      } catch (e) {
        console.error("Like error", e);
        const msg =
          e && (e.message || e.msg || e.error || e.detail)
            ? e.message || e.msg || e.error || e.detail
            : typeof e === "string"
              ? e
              : JSON.stringify(e);
        alert("Could not update like: " + msg);
      }
    });

    const commentBtn = node.querySelector(".comment-btn");
    const commentArea = node.querySelector(".comment-area");
    const submitComment = node.querySelector(".submit-comment");
    const commentInput = node.querySelector(".comment-input");
    commentBtn.addEventListener("click", () =>
      commentArea.classList.toggle("hidden"),
    );
    submitComment.addEventListener("click", async () => {
      const v = commentInput.value.trim();
      if (!v) return;
      try {
        const uresp = await SocialSupabase.getUser();
        const sup = uresp.data?.user;
        if (!sup) return alert("Sign in to comment");
        const res = await SocialSupabase.addComment(post.id, v);
        if (res.error) throw res.error;
        await renderPosts();
      } catch (e) {
        console.error("Comment error", e);
        const msg =
          e && (e.message || e.msg || e.error || e.detail)
            ? e.message || e.msg || e.error || e.detail
            : typeof e === "string"
              ? e
              : JSON.stringify(e);
        alert("Could not add comment: " + msg);
      }
    });

    const footer = node.querySelector(".post-footer");
    if (footer) {
      const del = document.createElement("button");
      del.className = "action delete-btn";
      del.textContent = "Delete";
      del.style.marginLeft = "auto";
      if (post.author !== currentUser) del.style.display = "none";
      del.addEventListener("click", async () => {
        if (!confirm("Delete this post?")) return;
        try {
          await SocialSupabase.deletePostById(post.id);
          await renderPosts();
        } catch (e) {
          console.error("Failed to delete post", e);
          alert("Could not delete post");
        }
      });
      footer.appendChild(del);
    }

    feed.appendChild(node);
  });
}

renderPosts();

// Logout handler
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      if (window.SocialSupabase) {
        await SocialSupabase.logout();
      }
      localStorage.removeItem("user");
    } catch (e) {}
    window.location.href = "login.html";
  });
}
