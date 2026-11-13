# Neo Glide developer website

The public developer website and AdMob app-ads.txt are hosted separately from
the admin dashboard in the existing `neo-glide-live` Firebase project.

Website: https://neo-glide-live-developer.web.app/

AdMob file: https://neo-glide-live-developer.web.app/app-ads.txt

Android volunteer guide: https://neo-glide-live-developer.web.app/android-test.html

The guide currently says version 1.3.0 (5) is awaiting Play review. Update that
status only after the closed build is approved and available. The group and Play
enrollment links are separate; group membership alone does not start a tester's
14-day closed-test enrollment. This page has no analytics or registration form.

From this directory, deploy only this website:

```sh
npx -y firebase-tools@latest deploy --only hosting:developer --project neo-glide-live
```

The `public/app-ads.txt` file must match `../public/app-ads.txt` and the personalized
snippet shown by AdMob. This directory does not deploy the game, admin dashboard,
Cloud Functions, authentication, or database rules.

For iOS verification, set the App Store Connect **Marketing URL** to the published
website root. AdMob discovers `/app-ads.txt` from the developer website linked by
the published store listing. The store update and AdMob crawl must complete before
verification can succeed.

The main admin Hosting site also redirects `/app-ads.txt` and `/robots.txt` to
this developer site. Keep those exact-path redirects in `../firebase.json`:
otherwise its SPA fallback returns HTML for these crawler requests. These
redirects cover both `neo-glide-live.web.app` and `neo-glide-live.firebaseapp.com`.
