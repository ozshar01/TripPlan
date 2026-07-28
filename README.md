# PWA לתכנון טיולים מבוססת Excel

## עריכת התוכן
1. פתחו את `source/trip-template.xlsx`.
2. ערכו את הגיליונות לפי הכותרות. אין לשנות את שמות הגיליונות או הכותרות.
3. הפעילו:
   `python tools/build_pwa.py`
4. התוצאה תיכתב ל־`data/trip-data.js` ול־`data/trip-data.json`.

## הרצה מקומית
מתיקיית הפרויקט:
`python -m http.server 8080`
פתחו בדפדפן: `http://localhost:8080`

## פרסום
העלו את כל התיקייה לשירות אחסון סטטי עם HTTPS כגון GitHub Pages, Azure Static Web Apps, Netlify או Cloudflare Pages.

## התקנה בטלפון
- iPhone/iPad: פתחו ב־Safari, לחצו שיתוף, הוספה למסך הבית, Open as Web App.
- Android: פתחו ב־Chrome, תפריט, Add to Home screen, Install.

## פרטיות
הסימונים האישיים נשמרים ב־localStorage במכשיר. מספרי הזמנה רגישים לא מומלץ לכלול בפרסום ציבורי.


## השמעת משפטים ביפנית
במסך יפנית קיימים כפתורי השמעה רגילה, השמעה איטית ועצירה. ההקראה משתמשת בקול היפני המותקן במכשיר דרך Web Speech API, ללא מפתח API וללא עלות.
