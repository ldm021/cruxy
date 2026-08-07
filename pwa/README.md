# Cruxy — crucigramas en familia

PWA para resolver crucigramas de revista entre varias personas, en tiempo real,
desde el navegador del celular. Se instala en la pantalla de inicio en Android y
en iPhone.

**Cómo funciona:** alguien saca una foto del crucigrama → una Cloud Function se
la pasa a Claude (modelo con visión) → Claude devuelve la grilla y las pistas →
todos ven la misma grilla y escriben letras que aparecen al instante en el resto
de los teléfonos → cuando alguien completa una palabra, al resto le llega un
aviso push.

---

## Estado

El código está completo. Falta **conectarlo a tu proyecto de Firebase y a tu API
key de Anthropic** — son los dos pasos que necesitan credenciales tuyas y están
detallados abajo.

---

## 1. Crear el proyecto de Firebase

1. Entra a <https://console.firebase.google.com> → **Agregar proyecto**.
   Ponle el nombre que quieras (por ejemplo `cruxy`).
2. **Haz upgrade al plan Blaze** (⚙ → Uso y facturación). Las Cloud Functions
   no corren en el plan gratuito Spark. Blaze tiene una capa gratuita generosa;
   para 3-5 personas el costo de Firebase va a ser prácticamente cero (lo que sí
   se paga es cada extracción de crucigrama con la API de Claude).
3. Dentro del proyecto, activa estos cuatro servicios:
   - **Authentication** → Comenzar → pestaña *Sign-in method* → habilita
     **Anónimo**.
   - **Firestore Database** → Crear base de datos → modo producción → elige una
     región cerca de ti (`southamerica-east1` si estás en Argentina).
   - **Storage** → Comenzar → misma región.
   - **Cloud Messaging** — ya viene activo, no hay que hacer nada aquí todavía.
4. Registra una **app web**: ⚙ Configuración del proyecto → *Tus apps* → ícono
   `</>` → nombre `cruxy-web` → **Registrar app**.
   Copia el objeto `firebaseConfig` que aparece.
5. Saca la **clave VAPID** para push web: ⚙ Configuración → pestaña *Cloud
   Messaging* → sección **Certificados push web** → *Generar par de claves* →
   copia la clave que empieza con `B...`.

### Pegar las credenciales

```bash
cd pwa
cp .env.example .env
```

Edita `.env` con los valores del paso 4 y la clave VAPID del paso 5:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=cruxy.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=cruxy
VITE_FIREBASE_STORAGE_BUCKET=cruxy.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
VITE_FIREBASE_VAPID_KEY=BN...
VITE_FUNCTIONS_REGION=us-central1
```

Y el ID del proyecto para la CLI:

```bash
cp .firebaserc.example .firebaserc   # y reemplaza TU-PROJECT-ID
```

> Estas claves **no son secretas**: viajan igual al navegador de cualquiera que
> abra la app. Lo que protege los datos son `firestore.rules` y `storage.rules`.

---

## 2. Guardar la API key de Anthropic

La key **nunca** va en el frontend. Vive en Secret Manager y solo la ve la Cloud
Function:

```bash
cd pwa
npm install -g firebase-tools     # si no la tienes
firebase login
firebase functions:secrets:set ANTHROPIC_API_KEY
# pega la key cuando la pida (empieza con sk-ant-...)
```

Si es la primera vez que usas secretos en el proyecto, la CLI te va a pedir que
habilites la API de Secret Manager: dile que sí.

### Elegir el modelo

Por defecto se usa **`claude-opus-5`**, que es el que mejor lee fotos de
crucigramas (grillas torcidas, letra chica, sombras). Para cambiarlo, crea un
archivo `functions/.env` con:

```
CRUXY_MODEL=claude-sonnet-5
```

`claude-sonnet-5` es bastante más barato y suele alcanzar para crucigramas
chicos y bien fotografiados. El mismo archivo acepta `CRUXY_STORAGE_BUCKET` si
tu proyecto no usa el bucket de Storage por defecto.

> El pedido original mencionaba `claude-sonnet-4-6` "ajustando a la versión
> disponible en el momento": `claude-opus-5` es hoy el modelo con mejor visión
> para esta tarea y cuesta lo mismo que Opus 4.8. Cambiarlo es una línea.

---

## Probar sin Firebase (modo demo)

Antes de conectar a nadie, puedes probar la extracción y jugar tú solo en el
navegador. No hace falta Firebase para esto — solo la API key de Anthropic.

### a) Leer un crucigrama de una foto

```bash
cd pwa
npm install
npm --prefix functions install

node scripts/extract-local.mjs ruta/a/la/foto.jpg
```

Usa exactamente el mismo código que la Cloud Function, así que lo que veas es lo
que va a guardar la app. Imprime en la terminal la grilla que leyó (para
compararla de un vistazo con la foto), todas las pistas con su posición y
longitud, y cualquier advertencia de la validación. El resultado queda en
`public/demo-crossword.json`.

### b) Jugarlo en el navegador

```bash
VITE_DEMO=1 npm run dev
```

Abre <http://localhost:5173>. Funciona igual que la app real — eliges nombre,
escribes letras, cambias entre horizontal y vertical, se tachan las pistas
completas — pero las letras se guardan solo en tu navegador y no hay push.

> El `public/demo-crossword.json` que viene en el repo es una **transcripción
> manual** de un crucigrama de revista, para que el modo demo funcione sin
> gastar una llamada a la API. Corre el script del punto (a) para reemplazarlo
> por una extracción real.

### Dos convenciones de numeración

Los crucigramas de periódico numeran **cada palabra** (el número va impreso
dentro de la casilla). Los de revista española numeran **filas y columnas**: la
"5 horizontal" es toda la fila 5, que suele contener varias palabras separadas
por casillas negras. La app soporta las dos: identifica cada palabra por la
casilla donde empieza, no por su número, y los avisos incluyen el texto de la
pista para que no haya ambigüedad cuando tres palabras comparten el número.

---

## 3. Instalar y probar en local

```bash
cd pwa
npm install
npm --prefix functions install
npm run dev            # http://localhost:5173
```

Para probar todo sin tocar producción (Firestore, Auth, Storage y Functions
locales):

```bash
# pon VITE_USE_EMULATORS=1 en .env
firebase emulators:start
npm run dev
```

Ojo: los emuladores no mandan push reales; para probar las notificaciones hay
que desplegar.

---

## 4. Desplegar

```bash
cd pwa
npm run build
firebase deploy
```

Eso publica hosting, reglas de Firestore y Storage, y las dos Cloud Functions.
Al terminar, la CLI imprime la URL:

```
Hosting URL: https://TU-PROJECT-ID.web.app
```

Ese es el link que le pasas a la familia.

Comandos parciales, por si quieres desplegar de a poco:

```bash
npm run deploy:hosting     # solo el frontend
npm run deploy:functions   # solo las funciones
npm run deploy:rules       # solo las reglas de seguridad
```

---

## 5. Instalar la app en el celular

- **Android (Chrome):** abre la URL → menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** abre la URL → botón Compartir → *Agregar a pantalla de
  inicio*.

> En iPhone las **notificaciones push solo funcionan con la app ya agregada a la
> pantalla de inicio** (iOS 16.4 o más nuevo). En un Safari normal no hay push:
> es una limitación de iOS, no de la app. En Android funcionan igual instalada o
> no.

La primera vez que entras, la app pide nombre y avatar. Después, cuando quieras
recibir avisos, acepta el permiso de notificaciones que ofrece el navegador.

---

## Cerrar el acceso solo a tu familia

Por defecto entra cualquiera que tenga la URL (usa autenticación anónima). Para
cerrarlo:

1. Que cada uno entre una vez a la app.
2. Firebase Console → **Authentication** → *Usuarios* → copia los UID.
3. Edita `firestore.rules`, función `allowlist()`:

   ```
   function allowlist() {
     return ['uid-de-mario', 'uid-de-ana', 'uid-de-lucia'];
   }
   ```

4. `npm run deploy:rules`

---

## Estructura

```
pwa/
├── src/
│   ├── components/     GridCell, CrosswordGrid, CluesPanel, PhotoUpload,
│   │                   CrosswordPicker, NamePrompt, UserBadge, Toasts
│   ├── hooks/          useAuth, useCrosswordSync, useCrosswordList,
│   │                   useNotifications
│   ├── firebase/       config, firestore, storage, messaging
│   ├── lib/            crossword (lógica pura de grilla), image (redimensionar)
│   ├── App.jsx
│   └── styles.css
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js           service worker único: cache + push de FCM
│   └── icons/          generados con `npm run icons`
├── functions/
│   ├── index.js
│   ├── extractCrossword.js    foto → Claude → Firestore
│   ├── checkWordCompletion.js palabra completa → push al resto
│   └── lib/            anthropic (llamada al modelo), crossword (validación)
├── firestore.rules
├── storage.rules
└── firebase.json
```

## Datos en Firestore

```
crosswords/{crosswordId}
  title        string
  createdBy    string      nombre de quien subió la foto
  createdByUid string
  createdAt    timestamp
  rows, cols   number
  grid         [{ cells: [{ blocked: bool, number: number|null }, ...] }, ...]
  clues        { across: [{number,row,col,length,text}], down: [...] }
  status       "active" | "completed"
  completed    { "5-across": { by, byUid, at } }   palabras ya anunciadas
  sourceImage  string      ruta en Storage
  extraction   { model, warnings[], inputTokens, outputTokens }

crosswords/{crosswordId}/cells/{row}_{col}
  value        string      la letra, o "" si está vacía
  filledBy     string      nombre de quien la escribió
  filledByUid  string
  updatedAt    timestamp

users/{userId}
  name, avatar, fcmToken, updatedAt
```

> **Sobre `grid`:** el esquema original decía "array de arrays", pero Firestore
> no permite arrays anidados. Se guarda como un array de objetos `{ cells: [...] }`
> (uno por fila) y `hydrateGrid()` lo devuelve a la forma `grid[row][col]` al
> leerlo, tanto en el cliente como en las funciones.

---

## Cuánto cuesta

- **Firebase:** para 3-5 personas, dentro de la capa gratuita de Blaze.
- **Claude:** solo se paga al subir una foto (una llamada por crucigrama). Con
  `claude-opus-5` a $5/$25 por millón de tokens, cada extracción ronda unos pocos
  centavos de dólar. Resolver el crucigrama no cuesta nada: es todo Firestore.

## Solución de problemas

| Síntoma | Qué mirar |
|---|---|
| "Falta conectar Firebase" al abrir | El `.env` está vacío o mal escrito. Después de editarlo hay que reiniciar `npm run dev`. |
| La foto sube pero falla la extracción | `firebase functions:log`. Suele ser la key de Anthropic sin configurar, o una foto muy inclinada/borrosa. |
| La grilla sale mal (filas de más, pistas fuera de lugar) | El campo `extraction.warnings` del documento en Firestore dice exactamente qué se corrigió o descartó. Saca la foto de frente, con toda la grilla adentro y sin sombras. |
| No llegan las notificaciones | En iPhone, ¿está la app agregada a la pantalla de inicio? ¿Aceptaron el permiso? ¿Está cargada `VITE_FIREBASE_VAPID_KEY`? Revisa `users/{uid}.fcmToken` en Firestore. |
| Las letras no se sincronizan | Consola del navegador: si dice `permission-denied`, revisa que las reglas estén desplegadas (`npm run deploy:rules`) y que el UID esté en la `allowlist()` si la usaste. |
