# Kenbak-1 Simulator

Un simulateur interactif du légendaire ordinateur Kenbak-1 (1971), souvent considéré comme le premier ordinateur personnel de l'histoire. Ce simulateur reproduit fidèlement l'interface et le comportement de l'ordinateur original.

## 🖥️ Démo en ligne

**[Essayer le simulateur](https://amennelet.github.io/KenbakSimulator/)**

## 📖 À propos du Kenbak-1

Le Kenbak-1 a été conçu par John Blankenbaker en 1971 et est reconnu par le Computer History Museum comme le premier ordinateur personnel. Avec ses 256 octets de mémoire et son interface à base de LEDs et de boutons, il était révolutionnaire pour l'époque.

### Caractéristiques originales :
- **Mémoire** : 256 octets (adresses 000-377 en octal)
- **Interface** : 15 LEDs d'état + boutons de contrôle
- **Architecture** : 8 bits avec registres spéciaux
- **Programmation** : Via boutons en façade, valeurs octales

## 🎮 Interface du simulateur

### LEDs d'affichage
- **ADDRESS (A)** : Affiche l'adresse mémoire actuelle (bits 0-7)
- **MEMORY (M)** : Affiche le contenu de la mémoire à l'adresse courante
- **Indicateurs** : POWER, RUN, OVERFLOW

### Boutons de contrôle

#### Groupe INPUT
- **0-7** : Saisie de données bit par bit
- **SET** : Valider la saisie

#### Groupe ADDR (Address)
- **0-7** : Saisie d'adresse bit par bit
- **SET** : Valider l'adresse

#### Groupe MEM (Memory)
- **READ** : Lire la mémoire à l'adresse courante
- **STORE** : Stocker la valeur dans la mémoire

#### Groupe RUN
- **START** : Démarrer l'exécution du programme
- **STOP** : Arrêter l'exécution
- **CLEAR** : Effacer et réinitialiser

## 🔧 Instructions supportées

Le simulateur implémente le jeu d'instructions complet du Kenbak-1 :

### Instructions arithmétiques
- **ADD** : Addition
- **SUB** : Soustraction
- **LNEG** : Négation logique

### Instructions logiques
- **AND** : ET logique
- **OR** : OU logique

### Instructions de transfert
- **LOAD** : Charger en mémoire
- **STORE** : Stocker depuis mémoire

### Instructions de contrôle
- **JUMP** : Saut inconditionnel
- **SKIP** : Saut conditionnel
- **NOOP** : Aucune opération
- **HALT** : Arrêt du programme

### Instructions de manipulation
- **SET** : Définir une valeur
- **SHIFT** : Décalage de bits
- **ROTATE** : Rotation de bits

### Modes d'adressage
1. **Immédiat** : Valeur directe
2. **Direct** : Adresse mémoire
3. **Indirect** : Adresse pointée
4. **Indexé** : Avec offset
5. **Indirect indexé** : Combinaison

## 🛠️ Implémentation technique

### Technologies utilisées
- **Phaser.js 3.x** : Moteur de rendu pour l'interface graphique
- **TypeScript** : Développement type-safe
- **Vite** : Build system moderne
- **GitHub Actions** : Déploiement automatique

### Architecture du code

```
src/
├── main.ts           # Point d'entrée, configuration Phaser
├── counter.ts        # Utilitaires (legacy)
├── style.css         # Styles globaux
└── scenes/
    └── MainScene.ts  # Scène principale avec toute la logique
```

### Composants principaux

#### 1. Gestion de la mémoire
```typescript
private memory: Uint8Array = new Uint8Array(256);
private programCounter: number = 0;
private addressRegister: number = 0;
private dataRegister: number = 0;
```

#### 2. Décodage d'instructions
Le simulateur analyse chaque instruction selon les patterns de bits du Kenbak-1 original :
- Bits 0-1 : Mode d'adressage
- Bits 2-7 : Code opération et opérandes

#### 3. Interface graphique
- LEDs interactives avec états ON/OFF
- Boutons cliquables avec feedback visuel
- Table mémoire 16x16 en notation octale
- Indicateurs d'état temps réel

#### 4. Moteur d'exécution
- Cycle fetch-decode-execute authentique
- Exécution automatique (1 instruction/seconde)
- Gestion des conditions de saut
- Détection d'instructions HALT

## 🚀 Installation et développement

### Prérequis
- Node.js 18+
- npm ou yarn

### Installation
```bash
git clone https://github.com/amennelet/KenbakSimulator.git
cd KenbakSimulator
npm install
```

### Développement
```bash
npm run dev
```
Le simulateur sera accessible sur `http://localhost:5173`

### Build de production
```bash
npm run build
```

### Déploiement
Le projet utilise GitHub Actions pour un déploiement automatique sur GitHub Pages à chaque push sur la branche `main`.

## 📚 Comment utiliser le simulateur

### 1. Saisir un programme simple
1. Utilisez les boutons ADDR pour définir une adresse (ex: 000)
2. Utilisez les boutons INPUT pour saisir une instruction
3. Cliquez SET pour valider
4. Répétez pour chaque instruction

### 2. Exécuter le programme
1. Définissez l'adresse de départ avec ADDR
2. Cliquez START pour lancer l'exécution automatique
3. Observez les LEDs et la table mémoire

### 3. Contrôle manuel
- READ : Afficher le contenu d'une adresse
- STORE : Sauvegarder une valeur
- STOP : Arrêter l'exécution
- CLEAR : Réinitialiser

## 🎯 Exemple de programme

Programme simple qui charge la valeur 42 (052 octal) :
```
Adresse 000: 300  (SET direct)
Adresse 001: 010  (adresse cible) 
Adresse 002: 052  (valeur 42)
Adresse 010: 000  (résultat)
```

## 🏗️ Fonctionnalités

- ✅ Interface authentique avec LEDs et boutons
- ✅ Jeu d'instructions complet Kenbak-1
- ✅ Tous les modes d'adressage
- ✅ Exécution automatique et manuelle
- ✅ Visualisation mémoire en temps réel
- ✅ Indicateurs d'état (RUN, OVERFLOW, etc.)
- ✅ Responsive design
- ✅ Déployé sur GitHub Pages

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Ajouter des programmes d'exemple
- Améliorer la documentation

## 📜 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📖 Ressources

- [Documentation originale Kenbak-1](http://www.kenbak-1.net/)
- [Computer History Museum](https://computerhistory.org/)
- [Phaser.js Documentation](https://phaser.io/learn)

---

**Note historique** : Ce simulateur est un hommage au Kenbak-1 et à son créateur John Blankenbaker. Il vise à préserver et partager l'expérience de programmation de ce pionnier de l'informatique personnelle.