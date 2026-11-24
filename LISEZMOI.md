# PyPad (version web)

Éditeur Python pour iPad qui tourne dans Safari et s'installe sur l'écran d'accueil comme une app.
Aucun compte développeur Apple n'est nécessaire.

## Fichiers
Mets **tous** ces fichiers ensemble, à la racine du site :
`index.html`, `worker.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.

## 1. Mettre en ligne (gratuit, avec GitHub Pages)
1. Crée un compte sur github.com, puis un dépôt **public** nommé par exemple `pypad`.
2. Dans le dépôt : **Add file → Upload files**, glisse les 7 fichiers, puis **Commit changes**.
3. **Settings → Pages** : dans « Branch », choisis `main` et `/ (root)`, puis **Save**.
4. Après une minute environ, le site est en ligne à l'adresse `https://TON-PSEUDO.github.io/pypad/`.

Le site doit être en **HTTPS** (c'est automatique avec GitHub Pages), sinon `input()` et le mode hors ligne ne fonctionnent pas.
N'importe quel autre hébergement HTTPS convient aussi (serveur de l'établissement, Netlify…).

## 2. Déployer sur les iPads supervisés (MDM)
Dans ton MDM (Jamf, Mosyle, Intune…), crée un profil de configuration avec une charge utile **Web Clip** :
- **URL** : l'adresse du site (par exemple `https://TON-PSEUDO.github.io/pypad/`)
- **Libellé** : PyPad
- **Icône** : `apple-touch-icon.png`
- **Plein écran** : activé
- **Non supprimable** : activé, si tu veux qu'il reste sur les iPads

Puis attribue le profil aux iPads ou aux groupes voulus.

Si le réseau de l'établissement est filtré, il faut autoriser :
- l'adresse du site ;
- `cdn.jsdelivr.net`, d'où Python est téléchargé.

## 3. Bon à savoir
- **Premier lancement** : il faut Internet (environ 10 Mo pour Python, plus numpy/matplotlib s'ils sont importés). Ensuite tout est en cache et l'app fonctionne hors ligne.
- **Scripts** : ils sont enregistrés **sur l'iPad** (stockage local du navigateur). Ils ne sont pas partagés entre appareils. Pour récupérer un script, utilise « Télécharger le fichier .py » dans le menu ⋯.
- **Mise à jour** : remplace les fichiers sur le site. Les iPads récupèrent la nouvelle version au lancement suivant, s'ils ont du réseau.
- Python 3.12 (Pyodide 0.26.4). Pas de `tkinter` ni de `turtle`.

## Raccourcis (clavier physique)
- ⌘ Entrée ou ⌘ R : exécuter / arrêter
- Échap : arrêter le programme
- Tab : 4 espaces

Dans la console, toucher un message d'erreur place le curseur sur la ligne fautive.
