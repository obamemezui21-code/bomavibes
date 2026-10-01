// Facebook, Instagram, TikTok, Snapchat… open links in their own built-in
// browser, where Google refuses its sign-in popup ("disallowed_useragent").
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  return /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Snapchat|Line\/|; wv\)/i.test(navigator.userAgent)
}
