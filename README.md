Social Media Homepage Demo

Open `index.html` in your browser (live server recommended) to view the responsive social feed demo.

Features:
- Navbar with logo and profile icon
- Post creation box with character count
- Feed showing posts
- Like toggle and comment counter (basic interactions via JavaScript)

Files:
- index.html
- styles.css
- app.js

To run locally:
1. Open `index.html` in a browser, or run a static server (VS Code Live Server extension recommended).
2. Create posts, like, and comment to see interactions.

Supabase integration (optional)
- A helper script `supabase-client.js` is provided to connect to Supabase and perform auth + simple DB ops.
- Include it in your pages after loading the Supabase UMD or let the script load the UMD automatically.

Basic usage (in browser console or your page script):
```javascript
// wait until the library loads or use the queue helper
SocialSupabase.redirectBasedOnAuth('index.html','login.html');
// register
await SocialSupabase.register('email@example.com', 'password123', 'username');
// login
await SocialSupabase.login('email@example.com','password123');
// add post
await SocialSupabase.addPost({ text: 'Hello from Supabase', media: null });
// fetch posts
const posts = await SocialSupabase.fetchPosts();
console.log(posts);
```

Meta tags for older browsers (add to `<head>` of your HTML):
```html
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1">
```
