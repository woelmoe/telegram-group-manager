const fs = require('fs');
const path = require('path');

// Создаем директорию dist/renderer если её нет
const rendererDistDir = path.join(__dirname, 'dist', 'renderer');
if (!fs.existsSync(rendererDistDir)) {
  fs.mkdirSync(rendererDistDir, { recursive: true });
}

// Копируем index.html
const sourceHtml = path.join(__dirname, 'src', 'renderer', 'index.html');
const destHtml = path.join(rendererDistDir, 'index.html');

if (fs.existsSync(sourceHtml)) {
  fs.copyFileSync(sourceHtml, destHtml);
  console.log('✅ index.html скопирован');
} else {
  console.error('❌ Файл index.html не найден:', sourceHtml);
}

// Копируем styles.css
const sourceCss = path.join(__dirname, 'src', 'renderer', 'styles.css');
const destCss = path.join(rendererDistDir, 'styles.css');

if (fs.existsSync(sourceCss)) {
  fs.copyFileSync(sourceCss, destCss);
  console.log('✅ styles.css скопирован');
}