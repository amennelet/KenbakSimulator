import { Scene } from 'phaser';

// Types pour les modes d'adressage du Kenbak-1
type AddressingMode = 'IMMEDIATE' | 'MEMORY' | 'INDIRECT' | 'INDEXED' | 'INDIRECT_INDEXED';

// Structure d'une instruction décodée
interface DecodedInstruction {
    opcode: string;
    register: 'A' | 'B' | 'X' | 'UNCONDITIONAL';
    addressingMode: AddressingMode;
    operand: number;
    condition?: string; // Pour les instructions de saut
    bitPosition?: number; // Pour les instructions SKIP
    setBit?: boolean; // Pour les instructions SET (true = SET 1, false = SET 0)
    places?: number; // Pour les instructions SHIFT/ROTATE (nombre de places)
}

// Adresses mémoire spéciales du processeur en octal
const MEMORY_MAP = {
    // Registres principaux
    A_REGISTER: 0o000,      // 000 en octal -> 0 en décimal
    B_REGISTER: 0o001,      // 001 en octal -> 1 en décimal
    X_REGISTER: 0o002,      // 002 en octal -> 2 en décimal
    P_REGISTER: 0o003,      // 003 en octal -> 3 en décimal
    
    // Registres spéciaux
    OUTPUT_REGISTER: 0o200,  // 200 en octal -> 128 en décimal
    A_OVERFLOW: 0o201,      // 201 en octal -> 129 en décimal
    B_OVERFLOW: 0o202,      // 202 en octal -> 130 en décimal
    X_OVERFLOW: 0o203,      // 203 en octal -> 131 en décimal
    
    // Registre d'entrée
    INPUT_REGISTER: 0o377   // 377 en octal -> 255 en décimal
} as const;



export class MainScene extends Scene {
    private leds: Phaser.GameObjects.Arc[] = [];
    private memory: Uint8Array = new Uint8Array(256); // 256 octets de mémoire initialisés à 0
    
    // Variables d'état pour les opérations de console
    private isRunning: boolean = false; // État RUN/HALT
    private addressRegister: number = 0; // Registre d'adresse pour les opérations mémoire
    private displayMode: 'INPUT' | 'ADDRESS' | 'MEMORY' | 'OUTPUT' = 'OUTPUT'; // Mode d'affichage des LEDs
    private lastMemoryRead: number = 0; // Dernière valeur lue de la mémoire pour affichage
    
    // Tableau de mémoire pour l'affichage
    private memoryDisplayTexts: Phaser.GameObjects.Text[][] = [];
    
    // LEDs de contrôle
    private inputLed!: Phaser.GameObjects.Arc;
    private addrLed!: Phaser.GameObjects.Arc;
    private memLed!: Phaser.GameObjects.Arc;
    private runLed!: Phaser.GameObjects.Arc;
    
    // Timer pour l'exécution automatique
    private executionTimer: Phaser.Time.TimerEvent | null = null;

    constructor() {
        super({ key: 'MainScene' });
    }

    create() {
        // Définir le fond gris métallique clair - agrandi pour contenir le tableau
        this.add.rectangle(400, 450, 800, 900, 0xE0E0E0);

        // Créer les 8 LEDs avec leurs numéros
        const ledStartX = 250;
        for (let i = 0; i < 8; i++) {
            const x = ledStartX + i * 50; // Augmenté l'espacement
            const y = 230;
            // LED (en rouge foncé)
            const led = this.add.circle(x, y, 10, 0x800000);
            
            // Numéro décimal au-dessus
            this.add.text(x, y - 25, String(7 - i), { 
                color: '#000',
                fontSize: '16px',
                fontFamily: 'Arial'
            }).setOrigin(0.5);

            // Ajouter l'interrupteur à bascule sous la LED (carré)
            const switchSize = 20; // Taille carrée
            this.add.rectangle(x, y + 85, switchSize, switchSize, 0x202020)
                .setInteractive({ cursor: 'pointer' })
                .on('pointerdown', () => this.setInputBit(7 - i)); // LED i correspond au bit (7-i)
            // Contour de l'interrupteur
            this.add.rectangle(x, y + 85, switchSize + 2, switchSize + 2, 0x000000, 0).setStrokeStyle(1, 0x000000);

            this.leds.push(led);
        }

        // Valeurs octales sous chaque LED (bit 7=200₈, bit 6=100₈, bit 5=040₈, etc.)
        const octalValues = ['200', '100', '040', '020', '010', '004', '002', '001'];
        
        // Ajouter les valeurs octales sous chaque LED
        for (let i = 0; i < 8; i++) {
            const x = ledStartX + i * 50;
            // Ajouter la valeur octale
            this.add.text(x, 255, octalValues[i], {
                color: '#000',
                fontSize: '11px', // Police plus petite pour 3 chiffres
                fontFamily: 'Courier New', // Police monospace pour l'alignement
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        // Lignes de séparation pour les groupes octaux
        const groupRangesOctal = [
            { start: 6, end: 7, width: 90 },    // bits 7-6
            { start: 3, end: 5, width: 140 },   // bits 5-3
            { start: 0, end: 2, width: 140 }    // bits 2-0
        ];

        groupRangesOctal.forEach(group => {
            const startX = ledStartX + (7 - group.end) * 50;
            
            // Ligne de séparation pour le groupe
            this.add.rectangle((startX + group.width/2)-20, 265, group.width - 10, 2, 0x000000);
        });

        // Valeurs octales sous chaque LED
        const binaryValues = ['8', '4', '2', '1', '8', '4', '2', '1'];
        
        // Ajouter les valeurs octales sous chaque LED
        for (let i = 0; i < 8; i++) {
            const x = ledStartX + i * 50;
            // Ajouter la valeur octale
            this.add.text(x, 280, binaryValues[i], {
                color: '#000',
                fontSize: '14px',
                fontFamily: 'Arial'
            }).setOrigin(0.5);
        }

        // Lignes de séparation pour les groupes octaux
        const groupRangesBinary = [
            { start: 4, end: 7, width: 190 },   // bits 7-4
            { start: 0, end: 3, width: 190 }    // bits 3-0
        ];

        groupRangesBinary.forEach(group => {
            const startX = ledStartX + (7 - group.end) * 50;
            
            // Ligne de séparation pour le groupe
            this.add.rectangle((startX + group.width/2)-20, 290, group.width - 10, 2, 0x000000);
        });

        // Groupe INPUT aligné sous la LED 7
        const inputX = ledStartX; // Position de la première LED (LED 7)
        const inputStartY = 350; // Position verticale sous les interrupteurs
        
        // Titre du groupe
        this.add.text(inputX, inputStartY, 'INPUT', {
            color: '#000',
            fontSize: '14px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // LED du groupe INPUT
        this.inputLed = this.add.circle(inputX, inputStartY + 30, 10, 0x800000);

        // Bouton CLEAR (carré)
        this.add.rectangle(inputX, inputStartY + 70, 20, 20, 0x000000)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.clearInput());
        this.add.text(inputX, inputStartY + 95, 'CLEAR', {
            color: '#000',
            fontSize: '12px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Groupe ADDR
        const addrX = ledStartX + 100; // Position sous la LED 5 (2 LEDs d'écart avec INPUT)
        const addrStartY = inputStartY; // Même niveau vertical que le groupe INPUT
        
        // Titre du groupe, centré entre DISP et SET
        this.add.text(addrX + 25, addrStartY, 'ADDR', {
            color: '#000',
            fontSize: '14px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // LED au-dessus du bouton SET
        this.addrLed = this.add.circle(addrX + 40, addrStartY + 30, 10, 0x800000);

        // Boutons DISP et SET côte à côte (carrés)
        this.add.rectangle(addrX, addrStartY + 70, 20, 20, 0x000000)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.displayAddress());
        this.add.text(addrX, addrStartY + 95, 'DISP', {
            color: '#000',
            fontSize: '12px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.rectangle(addrX + 40, addrStartY + 70, 20, 20, 0x000000)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.setAddress());
        this.add.text(addrX + 40, addrStartY + 95, 'SET', {
            color: '#000',
            fontSize: '12px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Groupe MEM (même structure que ADDR)
        const memX = ledStartX + 200; // Position sous la LED 3 (2 LEDs d'écart avec ADDR)
        const memStartY = inputStartY;

        // Titre du groupe, centré entre READ et STOR
        this.add.text(memX + 25, memStartY, 'MEM', {
            color: '#000',
            fontSize: '14px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // LED au-dessus du bouton STOR
        this.memLed = this.add.circle(memX + 40, memStartY + 30, 10, 0x800000);

        // Boutons READ et STOR côte à côte (carrés)
        this.add.rectangle(memX, memStartY + 70, 20, 20, 0x000000)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.readMemoryOperation());
        this.add.text(memX, memStartY + 95, 'READ', {
            color: '#000',
            fontSize: '12px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.rectangle(memX + 40, memStartY + 70, 20, 20, 0x000000)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.storeMemory());
        this.add.text(memX + 40, memStartY + 95, 'STOR', {
            color: '#000',
            fontSize: '12px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Groupe RUN (même structure que ADDR et MEM)
        const runX = ledStartX + 300; // Position sous la LED 1 (2 LEDs d'écart avec MEM)
        const runStartY = inputStartY;

        // Titre du groupe, centré entre STRT et STOP
        this.add.text(runX + 25, runStartY, 'RUN', {
            color: '#000',
            fontSize: '14px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // LED au-dessus du bouton STOP
        this.runLed = this.add.circle(runX + 40, runStartY + 30, 10, 0x800000);

        // Boutons STRT et STOP côte à côte (carrés)
        this.add.rectangle(runX, runStartY + 70, 20, 20, 0x000000)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.startExecution());
        this.add.text(runX, runStartY + 95, 'STRT', {
            color: '#000',
            fontSize: '12px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.add.rectangle(runX + 40, runStartY + 70, 20, 20, 0x000000)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.stopExecution());
        this.add.text(runX + 40, runStartY + 95, 'STOP', {
            color: '#000',
            fontSize: '12px',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Créer le tableau de mémoire 16x16
        this.createMemoryDisplay();
    }

    update() {
        // La logique de mise à jour sera ajoutée ici
    }

    // Mettre à jour les LEDs de contrôle selon le mode d'affichage
    private updateControlLeds(): void {
        // Éteindre toutes les LEDs de contrôle
        this.inputLed.setFillStyle(0x800000); // Rouge foncé
        this.addrLed.setFillStyle(0x800000);
        this.memLed.setFillStyle(0x800000);
        this.runLed.setFillStyle(0x800000);

        // Allumer la LED correspondant au mode actuel
        switch (this.displayMode) {
            case 'INPUT':
                this.inputLed.setFillStyle(0xFF0000); // Rouge vif
                break;
            case 'ADDRESS':
                this.addrLed.setFillStyle(0xFF0000); // Rouge vif
                break;
            case 'MEMORY':
                this.memLed.setFillStyle(0xFF0000); // Rouge vif
                break;
            case 'OUTPUT':
                if (this.isRunning) {
                    this.runLed.setFillStyle(0xFF0000); // Rouge vif en mode RUN
                }
                break;
        }
    }

    // Créer le tableau de mémoire 16x16
    private createMemoryDisplay(): void {
        const startX = 80; // Position de départ à gauche, un peu plus centrée
        const startY = 500; // Position bien sous les groupes de contrôle
        const cellWidth = 40; // Largeur réduite pour tenir dans l'écran
        const cellHeight = 22; // Hauteur réduite

        // Titre du tableau
        this.add.text(startX + (16 * cellWidth) / 2, startY - 30, 'MEMORY (Octal)', {
            color: '#000',
            fontSize: '16px',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Créer les en-têtes de colonnes (0-F en hexadécimal pour les colonnes)
        for (let col = 0; col < 16; col++) {
            this.add.text(startX + col * cellWidth + cellWidth/2, startY - 10, col.toString(16).toUpperCase(), {
                color: '#666',
                fontSize: '12px',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        // Créer les en-têtes de lignes (0-F en hexadécimal pour les lignes)
        for (let row = 0; row < 16; row++) {
            this.add.text(startX - 20, startY + row * cellHeight + cellHeight/2, (row * 16).toString(16).toUpperCase().padStart(2, '0'), {
                color: '#666',
                fontSize: '12px',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        // Initialiser le tableau de textes et créer les cellules
        this.memoryDisplayTexts = [];
        for (let row = 0; row < 16; row++) {
            this.memoryDisplayTexts[row] = [];
            for (let col = 0; col < 16; col++) {
                const address = row * 16 + col;
                const x = startX + col * cellWidth + cellWidth/2;
                const y = startY + row * cellHeight + cellHeight/2;
                
                // Convertir la valeur en octal
                const octalValue = this.memory[address].toString(8).padStart(3, '0');
                
                // Créer le texte pour cette cellule
                const cellText = this.add.text(x, y, octalValue, {
                    color: '#000',
                    fontSize: '9px',
                    fontFamily: 'Courier New', // Police monospace pour l'alignement
                    backgroundColor: '#f0f0f0',
                    padding: { x: 1, y: 1 }
                }).setOrigin(0.5);

                // Ajouter un contour à la cellule
                this.add.rectangle(x, y, cellWidth - 1, cellHeight - 1, 0xffffff, 0)
                    .setStrokeStyle(1, 0xcccccc);

                this.memoryDisplayTexts[row][col] = cellText;
            }
        }
    }

    // Mettre à jour l'affichage du tableau de mémoire
    private updateMemoryDisplay(): void {
        for (let row = 0; row < 16; row++) {
            for (let col = 0; col < 16; col++) {
                const address = row * 16 + col;
                const octalValue = this.memory[address].toString(8).padStart(3, '0');
                this.memoryDisplayTexts[row][col].setText(octalValue);
                
                // Mettre en évidence l'adresse actuelle du registre d'adresse
                if (address === this.addressRegister) {
                    this.memoryDisplayTexts[row][col].setBackgroundColor('#ffff00'); // Jaune
                } else {
                    this.memoryDisplayTexts[row][col].setBackgroundColor('#f0f0f0'); // Gris clair
                }
            }
        }
    }

    // Méthodes pour manipuler la mémoire
    private readMemory(address: number): number {
        // S'assure que l'adresse est dans la plage valide
        if (address >= 0 && address < 256) {
            return this.memory[address];
        }
        console.warn(`Tentative de lecture à une adresse invalide: ${address}`);
        return 0;
    }

    private writeMemory(address: number, value: number): void {
        // S'assure que l'adresse est dans la plage valide
        if (address >= 0 && address < 256) {
            // S'assure que la valeur est un octet valide (0-255)
            this.memory[address] = value & 0xFF;
            // Mettre à jour l'affichage du tableau de mémoire
            this.updateMemoryDisplay();
        } else {
            console.warn(`Tentative d'écriture à une adresse invalide: ${address}`);
        }
    }


    
    // Constantes pour les bits OF et CA
    private readonly OF_BIT = 0;  // Position du bit Overflow
    private readonly CA_BIT = 1;  // Position du bit Carry
    private readonly OF_MASK = 1 << this.OF_BIT;
    private readonly CA_MASK = 1 << this.CA_BIT;



    private setOverflowCarry(register: 'A' | 'B' | 'X', overflow: boolean, carry: boolean): void {
        let value = 0;
        if (overflow) value |= this.OF_MASK;
        if (carry) value |= this.CA_MASK;
        this.writeMemory(MEMORY_MAP[`${register}_OVERFLOW`], value);
    }

    // Méthodes d'opérations arithmétiques
    private addToRegister(register: 'A' | 'B' | 'X', value: number): void {
        const currentValue = this.getRegister(`${register}_REGISTER`);
        const result = currentValue + value;
        
        // Détection du dépassement et de la retenue
        const carry = result > 0xFF;
        const overflow = ((currentValue ^ result) & (value ^ result) & 0x80) !== 0;
        
        // Mise à jour du registre et des bits OF/CA
        this.setRegister(`${register}_REGISTER`, result & 0xFF);
        this.setOverflowCarry(register, overflow, carry);
    }

    private subtractFromRegister(register: 'A' | 'B' | 'X', value: number): void {
        // Pour la soustraction, on ajoute le complément à 2
        this.addToRegister(register, (-value) & 0xFF);
    }



    // Méthodes d'accès aux registres
    private getRegister(register: keyof typeof MEMORY_MAP): number {
        return this.readMemory(MEMORY_MAP[register]);
    }

    private setRegister(register: keyof typeof MEMORY_MAP, value: number): void {
        this.writeMemory(MEMORY_MAP[register], value);
    }



    // Méthode pour mettre à jour l'affichage des LEDs en fonction du registre de sortie
    private updateOutputDisplay(): void {
        // Déterminer quelle valeur afficher selon le mode actuel
        let displayValue: number;
        
        switch (this.displayMode) {
            case 'INPUT':
                // Afficher le contenu de la location 377₈ (255 décimal) - registre d'entrée
                displayValue = this.readMemory(MEMORY_MAP.INPUT_REGISTER);
                break;
                
            case 'ADDRESS':
                // Afficher le contenu du registre d'adresse
                displayValue = this.addressRegister;
                break;
                
            case 'MEMORY':
                // Afficher la dernière valeur lue de la mémoire
                displayValue = this.lastMemoryRead;
                break;
                
            case 'OUTPUT':
            default:
                // Afficher le contenu de la location 200₈ (128 décimal) - registre de sortie
                displayValue = this.readMemory(MEMORY_MAP.OUTPUT_REGISTER);
                break;
        }
        
        // Mettre à jour les LEDs avec la valeur déterminée
        for (let i = 0; i < 8; i++) {
            // Vérifier si le bit i est défini dans displayValue
            const bitSet = (displayValue >> (7 - i)) & 1;
            
            // Changer la couleur de la LED : rouge vif si le bit est 1, rouge foncé si 0
            if (bitSet) {
                this.leds[i].setFillStyle(0xFF0000); // Rouge vif
            } else {
                this.leds[i].setFillStyle(0x800000); // Rouge foncé
            }
        }
    }

    // Opérations logiques
    private andRegister(register: 'A', value: number): void {
        const result = this.getRegister(`${register}_REGISTER`) & value;
        this.setRegister(`${register}_REGISTER`, result);
        // AND n'affecte pas OF et CA
    }

    private orRegister(register: 'A', value: number): void {
        const result = this.getRegister(`${register}_REGISTER`) | value;
        this.setRegister(`${register}_REGISTER`, result);
        // OR n'affecte pas OF et CA
    }



    // Tests de conditions pour les branchements
    private testCondition(register: 'A' | 'B' | 'X', condition: 'NonZero' | 'Zero' | 'LessThanZero' | 'Positive' | 'PositiveNonZero'): boolean {
        const value = this.getRegister(`${register}_REGISTER`);
        
        switch (condition) {
            case 'NonZero':
                return value !== 0;
            case 'Zero':
                return value === 0;
            case 'LessThanZero':
                return (value & 0x80) !== 0;  // Test du bit de signe (bit 7)
            case 'Positive':
                return (value & 0x80) === 0;  // Test si bit de signe est 0
            case 'PositiveNonZero':
                return value !== 0 && (value & 0x80) === 0;
            default:
                return false;
        }
    }

    // Méthodes pour gérer les modes d'adressage
    private resolveOperand(mode: AddressingMode, operandAddress: number): number {
        switch (mode) {
            case 'IMMEDIATE':
                // Mode Constant/Immediate : l'opérande est directement la valeur
                return operandAddress;

            case 'MEMORY':
                // Mode Memory : l'adresse contient l'opérande
                return this.readMemory(operandAddress);

            case 'INDIRECT':
                // Mode Indirect : l'adresse contient l'adresse de l'opérande
                const indirectAddress = this.readMemory(operandAddress);
                return this.readMemory(indirectAddress);

            case 'INDEXED':
                // Mode Indexed : adresse + contenu du registre X
                const xValue = this.getRegister('X_REGISTER');
                const indexedAddress = (operandAddress + xValue) & 0xFF;
                return this.readMemory(indexedAddress);

            case 'INDIRECT_INDEXED':
                // Mode Indirect Indexed : (adresse) + registre X
                const baseAddress = this.readMemory(operandAddress);
                const xReg = this.getRegister('X_REGISTER');
                const finalAddress = (baseAddress + xReg) & 0xFF;
                return this.readMemory(finalAddress);

            default:
                return 0;
        }
    }

    private resolveAddress(mode: AddressingMode, operandAddress: number): number {
        switch (mode) {
            case 'IMMEDIATE':
                // Pour STORE IMMEDIATE, on stocke dans le second mot de l'instruction
                return operandAddress;

            case 'MEMORY':
                // Mode Memory : retourne directement l'adresse
                return operandAddress;

            case 'INDIRECT':
                // Mode Indirect : l'adresse contient l'adresse finale
                return this.readMemory(operandAddress);

            case 'INDEXED':
                // Mode Indexed : adresse + contenu du registre X
                const xValue = this.getRegister('X_REGISTER');
                return (operandAddress + xValue) & 0xFF;

            case 'INDIRECT_INDEXED':
                // Mode Indirect Indexed : (adresse) + registre X
                const baseAddress = this.readMemory(operandAddress);
                const xReg = this.getRegister('X_REGISTER');
                return (baseAddress + xReg) & 0xFF;

            default:
                return operandAddress;
        }
    }

    // Méthodes pour les instructions avec différents modes d'adressage
    private loadRegister(register: 'A' | 'B' | 'X', mode: AddressingMode, operandAddress: number): void {
        const value = this.resolveOperand(mode, operandAddress);
        this.setRegister(`${register}_REGISTER`, value);
    }

    private storeRegister(register: 'A' | 'B' | 'X', mode: AddressingMode, operandAddress: number): void {
        const value = this.getRegister(`${register}_REGISTER`);
        const targetAddress = this.resolveAddress(mode, operandAddress);
        this.writeMemory(targetAddress, value);
    }

    private addToRegisterWithMode(register: 'A' | 'B' | 'X', mode: AddressingMode, operandAddress: number): void {
        const operand = this.resolveOperand(mode, operandAddress);
        this.addToRegister(register, operand);
    }

    private subtractFromRegisterWithMode(register: 'A' | 'B' | 'X', mode: AddressingMode, operandAddress: number): void {
        const operand = this.resolveOperand(mode, operandAddress);
        this.subtractFromRegister(register, operand);
    }

    private andRegisterWithMode(register: 'A', mode: AddressingMode, operandAddress: number): void {
        const operand = this.resolveOperand(mode, operandAddress);
        this.andRegister(register, operand);
    }

    private orRegisterWithMode(register: 'A', mode: AddressingMode, operandAddress: number): void {
        const operand = this.resolveOperand(mode, operandAddress);
        this.orRegister(register, operand);
    }

    private loadComplementWithMode(register: 'A', mode: AddressingMode, operandAddress: number): void {
        const operand = this.resolveOperand(mode, operandAddress);
        // LNEG charge le complément arithmétique (0 - opérande) dans le registre A
        const complement = (0 - operand) & 0xFF;
        this.setRegister(`${register}_REGISTER`, complement);
        
        // Note : L'instruction LNEG ne modifie pas les bits OF et CA selon la documentation
        // "This overflow is not detected nor is the A Register Overflow bit in location 201 altered by the LNEG instruction"
    }

    // Décodage des instructions
    private decodeAddressingMode(modeBits: number): AddressingMode {
        // Le mode d'adressage est dans les bits 2-1-0 du premier byte
        const mode = modeBits & 0b111;
        switch (mode) {
            case 0b011:
                return 'IMMEDIATE';
            case 0b100:
                return 'MEMORY';
            case 0b101:
                return 'INDIRECT';
            case 0b110:
                return 'INDEXED';
            case 0b111:
                return 'INDIRECT_INDEXED';
            default:
                return 'MEMORY'; // Par défaut
        }
    }

    private decodeRegister(registerBits: number): 'A' | 'B' | 'X' {
        // Les bits de registre sont 7-6 du premier byte
        const reg = (registerBits >> 6) & 0b11;
        switch (reg) {
            case 0b00:
                return 'A';
            case 0b01:
                return 'B';
            case 0b10:
                return 'X';
            default:
                return 'A'; // Par défaut (cas 0b11)
        }
    }

    private decodeInstruction(firstByte: number, secondByte: number): DecodedInstruction | null {
        const register = this.decodeRegister(firstByte);
        const addressingModeBits = firstByte & 0b111;
        const bit5 = (firstByte >> 5) & 1;
        const bits43 = (firstByte >> 3) & 0b11;
        
        // Vérifier que le bit 5 est à 0 et que le mode d'adressage est valide
        if (bit5 === 0 && (addressingModeBits >= 0b011 && addressingModeBits <= 0b111)) {
            const addressingMode = this.decodeAddressingMode(firstByte);
            
            switch (bits43) {
                case 0b00: // ADD (bits 4-3 = 00)
                    return {
                        opcode: 'ADD',
                        register: register,
                        addressingMode: addressingMode,
                        operand: secondByte
                    };
                
                case 0b01: // SUB (bits 4-3 = 01)
                    return {
                        opcode: 'SUB',
                        register: register,
                        addressingMode: addressingMode,
                        operand: secondByte
                    };
                
                case 0b10: // LOAD (bits 4-3 = 10)
                    return {
                        opcode: 'LOAD',
                        register: register,
                        addressingMode: addressingMode,
                        operand: secondByte
                    };
                
                case 0b11: // STORE (bits 4-3 = 11)
                    return {
                        opcode: 'STORE',
                        register: register,
                        addressingMode: addressingMode,
                        operand: secondByte
                    };
            }
        }

        // Vérification des instructions AND et OR (uniquement pour le registre A)
        const bits73 = (firstByte >> 3) & 0b11111; // Bits 7-3
        if (addressingModeBits >= 0b011 && addressingModeBits <= 0b111) {
            const addressingMode = this.decodeAddressingMode(firstByte);
            
            if (bits73 === 0b11010) { // AND : bits 7-3 = 11010
                return {
                    opcode: 'AND',
                    register: 'A',
                    addressingMode: addressingMode,
                    operand: secondByte
                };
            }
            
            if (bits73 === 0b11000) { // OR : bits 7-3 = 11000
                return {
                    opcode: 'OR',
                    register: 'A',
                    addressingMode: addressingMode,
                    operand: secondByte
                };
            }
            
            if (bits73 === 0b11011) { // LNEG : bits 7-3 = 11011
                return {
                    opcode: 'LNEG',
                    register: 'A',
                    addressingMode: addressingMode,
                    operand: secondByte
                };
            }
        }

        // Vérification des instructions JUMP (bit 5 = 1)
        const bit5Jump = (firstByte >> 5) & 1;
        if (bit5Jump === 1) {
            const registerBits = (firstByte >> 6) & 0b11;
            const isJumpAndMark = (firstByte >> 4) & 1;
            const isDirect = ((firstByte >> 3) & 1) === 0;
            const conditionBits = firstByte & 0b111;
            
            // Validation : les bits 2-1-0 doivent être 011, 100, 101, 110, ou 111
            if (conditionBits < 0b011 || conditionBits > 0b111) {
                return null; // Instruction JUMP invalide
            }
            
            // Déterminer le registre et la condition
            let testRegister: 'A' | 'B' | 'X' | 'UNCONDITIONAL' = 'A';
            let condition: string = 'NonZero';
            
            switch (registerBits) {
                case 0b00: testRegister = 'A'; break;
                case 0b01: testRegister = 'B'; break;
                case 0b10: testRegister = 'X'; break;
                case 0b11: testRegister = 'UNCONDITIONAL'; break;
            }
            
            switch (conditionBits) {
                case 0b011: condition = 'NonZero'; break;
                case 0b100: condition = 'Zero'; break;
                case 0b101: condition = 'LessThanZero'; break;
                case 0b110: condition = 'Positive'; break;
                case 0b111: condition = 'PositiveNonZero'; break;
                default: condition = 'NonZero'; break;
            }
            
            const opcode = isJumpAndMark ? 'JMD' : 'JPD';
            const addressingMode = isDirect ? 'MEMORY' : 'INDIRECT';
            
            return {
                opcode: opcode,
                register: testRegister as any,
                addressingMode: addressingMode,
                operand: secondByte,
                condition: condition
            };
        }

        // Vérification des instructions SKIP (bit 7 = 1, bits 2-0 = 010)
        const bit7 = (firstByte >> 7) & 1;
        const bits20 = firstByte & 0b111;
        
        if (bit7 === 1 && bits20 === 0b010) {
            const skipOnOne = (firstByte >> 6) & 1; // 0=SKIP on ZERO, 1=SKIP on ONE
            const bitPosition = (firstByte >> 3) & 0b111; // Bits 5-3 définissent la position du bit
            
            return {
                opcode: skipOnOne ? 'SKP1' : 'SKP0',
                register: 'A', // Pas utilisé pour SKIP mais requis par l'interface
                addressingMode: 'MEMORY',
                operand: secondByte, // Adresse mémoire à tester
                bitPosition: bitPosition
            };
        }

        // Vérification des instructions SET (bit 7 = 0, bits 2-0 = 010)
        if (bit7 === 0 && bits20 === 0b010) {
            const setToOne = (firstByte >> 6) & 1; // 0=SET to 0, 1=SET to 1
            const bitPosition = (firstByte >> 3) & 0b111; // Bits 5-3 définissent la position du bit
            
            return {
                opcode: 'SET',
                register: 'A', // Pas utilisé pour SET mais requis par l'interface
                addressingMode: 'MEMORY',
                operand: secondByte, // Adresse mémoire à modifier
                bitPosition: bitPosition,
                setBit: setToOne === 1
            };
        }

        // Vérification des instructions SHIFT et ROTATE (bits 2-0 = 001)
        if (bits20 === 0b001) {
            const isLeft = (firstByte >> 7) & 1; // 0=RIGHT, 1=LEFT
            const isRotate = (firstByte >> 6) & 1; // 0=SHIFT, 1=ROTATE
            const isRegisterB = (firstByte >> 5) & 1; // 0=A, 1=B
            const placesBits = (firstByte >> 3) & 0b11; // Bits 4-3 pour le nombre de places
            
            // Convertir les bits 4-3 en nombre de places (1, 2, 3, ou 4)
            const places = placesBits + 1;
            
            // Déterminer l'opcode
            let opcode: string;
            if (isRotate) {
                opcode = isLeft ? 'ROTL' : 'ROTR';
            } else {
                opcode = isLeft ? 'SFTL' : 'SFTR';
            }
            
            return {
                opcode: opcode,
                register: isRegisterB ? 'B' : 'A',
                addressingMode: 'IMMEDIATE', // Instructions à un seul byte
                operand: 0, // Pas d'opérande pour ces instructions
                places: places
            };
        }

        // Vérification des instructions NOOP et HALT (bits 2-0 = 000)
        if (bits20 === 0b000) {
            const bit7 = (firstByte >> 7) & 1;
            
            if (bit7 === 1) {
                // NOOP : bit 7 = 1, bits 2-0 = 000
                return {
                    opcode: 'NOOP',
                    register: 'A', // Pas utilisé mais requis par l'interface
                    addressingMode: 'IMMEDIATE', // Instruction à un seul byte
                    operand: 0
                };
            } else {
                // HALT : bit 7 = 0, bits 2-0 = 000
                return {
                    opcode: 'HALT',
                    register: 'A', // Pas utilisé mais requis par l'interface
                    addressingMode: 'IMMEDIATE', // Instruction à un seul byte
                    operand: 0
                };
            }
        }

        return null; // Instruction non reconnue
    }

    // Exécution des instructions
    private executeInstruction(instruction: DecodedInstruction): void {
        const { opcode, register, addressingMode, operand } = instruction;

        switch (opcode) {
            case 'ADD':
                if (register !== 'UNCONDITIONAL') {
                    this.addToRegisterWithMode(register, addressingMode, operand);
                }
                break;

            case 'SUB':
                if (register !== 'UNCONDITIONAL') {
                    this.subtractFromRegisterWithMode(register, addressingMode, operand);
                }
                break;

            case 'LOAD':
                if (register !== 'UNCONDITIONAL') {
                    this.loadRegister(register, addressingMode, operand);
                }
                break;

            case 'STORE':
                if (register !== 'UNCONDITIONAL') {
                    this.storeRegister(register, addressingMode, operand);
                }
                break;

            case 'AND':
                this.andRegisterWithMode('A', addressingMode, operand);
                break;

            case 'OR':
                this.orRegisterWithMode('A', addressingMode, operand);
                break;

            case 'LNEG':
                this.loadComplementWithMode('A', addressingMode, operand);
                break;

            case 'JPD': // Jump Direct
            case 'JMD': // Jump and Mark Direct
                this.executeJump(instruction);
                return; // Ne pas avancer le PC automatiquement car executeJump le gère

            case 'SKP0': // Skip on Zero
            case 'SKP1': // Skip on One
                this.executeSkip(instruction);
                return; // Ne pas avancer le PC automatiquement car executeSkip le gère

            case 'SET': // Set bit
                this.executeSet(instruction);
                break;

            case 'SFTL': // Shift Left
            case 'SFTR': // Shift Right
            case 'ROTL': // Rotate Left
            case 'ROTR': // Rotate Right
                this.executeShiftRotate(instruction);
                return; // Instructions à un seul byte : avancer le PC de 1

            case 'NOOP': // No Operation
            case 'HALT': // Halt
                this.executeControlInstruction(instruction);
                return; // Instructions à un seul byte : avancer le PC de 1

            default:
                console.warn(`Instruction non implémentée: ${opcode}`);
        }

        // Avancer le pointeur d'instruction (P Register) de 2
        const currentP = this.getRegister('P_REGISTER');
        this.setRegister('P_REGISTER', (currentP + 2) & 0xFF);
    }

    // Méthode principale pour exécuter une instruction à partir de la mémoire
    private fetchAndExecute(): void {
        const pc = this.getRegister('P_REGISTER');
        const firstByte = this.readMemory(pc);
        
        // Déterminer si c'est une instruction à un ou deux bytes
        const bits20 = firstByte & 0b111;
        const isOneByteInstruction = (bits20 === 0b001) || (bits20 === 0b000); // Instructions SHIFT/ROTATE et NOOP/HALT
        
        let secondByte = 0;
        if (!isOneByteInstruction) {
            secondByte = this.readMemory((pc + 1) & 0xFF);
        }

        const instruction = this.decodeInstruction(firstByte, secondByte);
        if (instruction) {
            this.executeInstruction(instruction);
        } else {
            console.warn(`Instruction non reconnue à l'adresse ${pc}: 0x${firstByte.toString(16).padStart(2, '0')}`);
            // Avancer le PC même si l'instruction n'est pas reconnue
            const increment = isOneByteInstruction ? 1 : 2;
            this.setRegister('P_REGISTER', (pc + increment) & 0xFF);
        }
    }

    // Méthode pour exécuter les instructions de saut
    private executeJump(instruction: DecodedInstruction): void {
        const { opcode, register, addressingMode, operand, condition } = instruction;
        const currentP = this.getRegister('P_REGISTER');
        
        // Déterminer l'adresse cible
        let targetAddress: number;
        if (addressingMode === 'MEMORY') {
            // Direct : l'adresse est directement dans le second byte
            targetAddress = operand;
        } else {
            // Indirect : l'adresse est contenue à l'adresse spécifiée par le second byte
            targetAddress = this.readMemory(operand);
        }
        
        // Évaluer la condition de saut
        let shouldJump = false;
        
        if (register === 'UNCONDITIONAL') {
            shouldJump = true;
        } else if (condition) {
            shouldJump = this.testCondition(register as 'A' | 'B' | 'X', condition as any);
        }
        
        if (shouldJump) {
            // Effectuer le saut
            if (opcode === 'JMD') {
                // Jump and Mark : sauvegarder l'adresse de retour (P + 2) à l'adresse cible
                const returnAddress = (currentP + 2) & 0xFF;
                this.writeMemory(targetAddress, returnAddress);
                // Puis exécuter l'instruction à l'adresse cible + 1
                this.setRegister('P_REGISTER', (targetAddress + 1) & 0xFF);
            } else {
                // Jump simple : aller directement à l'adresse cible
                this.setRegister('P_REGISTER', targetAddress);
            }
        } else {
            // Condition non remplie : continuer normalement
            this.setRegister('P_REGISTER', (currentP + 2) & 0xFF);
        }
    }

    // Méthode pour exécuter les instructions SKIP
    private executeSkip(instruction: DecodedInstruction): void {
        const { opcode, operand, bitPosition } = instruction;
        const currentP = this.getRegister('P_REGISTER');
        
        // Lire la valeur à l'adresse mémoire spécifiée
        const memoryValue = this.readMemory(operand);
        
        // Tester le bit spécifié
        const bitValue = (memoryValue >> (bitPosition || 0)) & 1;
        
        // Déterminer si on doit skipper
        let shouldSkip = false;
        if (opcode === 'SKP0') {
            // Skip si le bit est à 0
            shouldSkip = (bitValue === 0);
        } else if (opcode === 'SKP1') {
            // Skip si le bit est à 1
            shouldSkip = (bitValue === 1);
        }
        
        if (shouldSkip) {
            // Skipper : avancer de 4 (saute l'instruction suivante qui peut être sur 2 octets)
            this.setRegister('P_REGISTER', (currentP + 4) & 0xFF);
        } else {
            // Ne pas skipper : continuer normalement
            this.setRegister('P_REGISTER', (currentP + 2) & 0xFF);
        }
    }

    // Méthode pour exécuter les instructions SET
    private executeSet(instruction: DecodedInstruction): void {
        const { operand, bitPosition, setBit } = instruction;
        
        // Lire la valeur actuelle à l'adresse mémoire spécifiée
        const memoryValue = this.readMemory(operand);
        
        // Calculer le masque pour le bit à modifier
        const bitMask = 1 << (bitPosition || 0);
        
        let newValue: number;
        if (setBit) {
            // SET 1 : mettre le bit à 1
            newValue = memoryValue | bitMask;
        } else {
            // SET 0 : mettre le bit à 0
            newValue = memoryValue & ~bitMask;
        }
        
        // Écrire la nouvelle valeur en mémoire
        this.writeMemory(operand, newValue);
    }

    // Méthode pour exécuter les instructions SHIFT et ROTATE
    private executeShiftRotate(instruction: DecodedInstruction): void {
        const { opcode, register, places } = instruction;
        const currentP = this.getRegister('P_REGISTER');
        
        // S'assurer que le registre est A ou B pour les opérations SHIFT/ROTATE
        if (register !== 'A' && register !== 'B') {
            console.warn(`Registre invalide pour SHIFT/ROTATE: ${register}`);
            return;
        }
        
        // Lire la valeur actuelle du registre
        const currentValue = this.getRegister(`${register}_REGISTER`);
        let newValue = currentValue;
        
        // Effectuer l'opération le nombre de fois spécifié
        for (let i = 0; i < (places || 1); i++) {
            switch (opcode) {
                case 'SFTL': // Shift Left
                    newValue = (newValue << 1) & 0xFF; // Décaler à gauche, bit 0 devient 0
                    break;
                    
                case 'SFTR': // Shift Right
                    const signBit = newValue & 0x80; // Sauver le bit de signe (bit 7)
                    newValue = (newValue >> 1) | signBit; // Décaler à droite et conserver le bit de signe
                    break;
                    
                case 'ROTL': // Rotate Left
                    const leftBit = (newValue & 0x80) >> 7; // Sauver le bit 7
                    newValue = ((newValue << 1) & 0xFF) | leftBit; // Décaler et réinjecter le bit 7 en position 0
                    break;
                    
                case 'ROTR': // Rotate Right
                    const rightBit = newValue & 0x01; // Sauver le bit 0
                    newValue = (newValue >> 1) | (rightBit << 7); // Décaler et réinjecter le bit 0 en position 7
                    break;
            }
        }
        
        // Écrire la nouvelle valeur dans le registre
        this.setRegister(`${register}_REGISTER`, newValue);
        
        // Avancer le pointeur d'instruction de 1 (instruction à un seul byte)
        this.setRegister('P_REGISTER', (currentP + 1) & 0xFF);
    }

    // Méthode pour exécuter les instructions de contrôle (NOOP et HALT)
    private executeControlInstruction(instruction: DecodedInstruction): void {
        const { opcode } = instruction;
        const currentP = this.getRegister('P_REGISTER');
        
        switch (opcode) {
            case 'NOOP':
                // No Operation : ne fait rien, juste avancer le PC
                break;
                
            case 'HALT':
                // Halt : arrêter l'exécution et passer en état HALT
                console.log('HALT instruction exécutée - Arrêt du processeur');
                this.isRunning = false;
                this.displayMode = 'OUTPUT'; // Retour au mode d'affichage par défaut
                this.updateControlLeds(); // Éteindre la LED RUN
                break;
        }
        
        // Avancer le pointeur d'instruction de 1 (instruction à un seul byte)
        this.setRegister('P_REGISTER', (currentP + 1) & 0xFF);
    }

    // Méthode pour exécuter un cycle d'instruction
    private executeCycle(): void {
        if (this.isRunning) {
            this.fetchAndExecute();
            this.updateOutputDisplay(); // Mettre à jour l'affichage après chaque instruction
            
            // Vérifier si l'instruction HALT a été exécutée
            if (!this.isRunning) {
                // L'instruction HALT a mis isRunning à false, arrêter le timer
                if (this.executionTimer) {
                    this.executionTimer.destroy();
                    this.executionTimer = null;
                }
                console.log('Execution stopped by HALT instruction');
            }
        }
    }

    // === OPÉRATIONS DE CONSOLE ===

    // Bouton CLEAR - Efface le contenu de la location 377₈ (registre d'entrée)
    private clearInput(): void {
        this.writeMemory(MEMORY_MAP.INPUT_REGISTER, 0);
        this.displayMode = 'INPUT';
        this.updateOutputDisplay();
        this.updateControlLeds(); // Allumer la LED INPUT
        console.log('INPUT register cleared');
    }

    // Boutons de données - Basculent un bit dans la location 377₈
    private setInputBit(bitPosition: number): void {
        const currentValue = this.readMemory(MEMORY_MAP.INPUT_REGISTER);
        const newValue = currentValue ^ (1 << bitPosition); // Basculer le bit (XOR)
        this.writeMemory(MEMORY_MAP.INPUT_REGISTER, newValue);
        this.displayMode = 'INPUT';
        this.updateOutputDisplay();
        this.updateControlLeds(); // Allumer la LED INPUT
        console.log(`INPUT register bit ${bitPosition} toggled, value: ${newValue.toString(2).padStart(8, '0')} (${newValue.toString(8).padStart(3, '0')} octal)`);
    }

    // Bouton ADDRESS DISPLAY - Affiche le contenu du registre d'adresse
    private displayAddress(): void {
        this.displayMode = 'ADDRESS';
        this.updateOutputDisplay();
        this.updateControlLeds(); // Allumer la LED ADDR
        this.updateMemoryDisplay(); // Mettre à jour la surbrillance de l'adresse
        console.log(`Address register: ${this.addressRegister}`);
    }

    // Bouton ADDRESS SET - Définit le registre d'adresse avec le contenu de 377₈
    private setAddress(): void {
        this.addressRegister = this.readMemory(MEMORY_MAP.INPUT_REGISTER);
        this.displayMode = 'ADDRESS';
        this.updateOutputDisplay();
        this.updateControlLeds(); // Allumer la LED ADDR
        this.updateMemoryDisplay(); // Mettre à jour la surbrillance de l'adresse
        console.log(`Address register set to: ${this.addressRegister}`);
    }

    // Bouton MEMORY READ - Lit la mémoire à l'adresse spécifiée et avance le registre d'adresse
    private readMemoryOperation(): void {
        if (this.isRunning) {
            console.warn('Cannot read memory while running');
            return;
        }
        
        this.lastMemoryRead = this.readMemory(this.addressRegister);
        this.displayMode = 'MEMORY';
        this.addressRegister = (this.addressRegister + 1) & 0xFF; // Incrémenter et maintenir dans la plage 0-255
        this.updateOutputDisplay();
        this.updateControlLeds(); // Allumer la LED MEM
        this.updateMemoryDisplay(); // Mettre à jour la surbrillance de l'adresse
        console.log(`Memory read from address ${this.addressRegister - 1}: ${this.lastMemoryRead.toString(2).padStart(8, '0')}`);
    }

    // Bouton MEMORY STORE - Stocke le contenu de 377₈ à l'adresse spécifiée et avance le registre d'adresse
    private storeMemory(): void {
        if (this.isRunning) {
            console.warn('Cannot store memory while running');
            return;
        }
        
        const valueToStore = this.readMemory(MEMORY_MAP.INPUT_REGISTER);
        this.writeMemory(this.addressRegister, valueToStore);
        this.displayMode = 'MEMORY';
        this.lastMemoryRead = valueToStore; // Pour l'affichage
        this.addressRegister = (this.addressRegister + 1) & 0xFF; // Incrémenter et maintenir dans la plage 0-255
        this.updateOutputDisplay();
        this.updateControlLeds(); // Allumer la LED MEM
        this.updateMemoryDisplay(); // Mettre à jour la surbrillance de l'adresse
        console.log(`Memory stored at address ${this.addressRegister - 1}: ${valueToStore.toString(2).padStart(8, '0')}`);
    }

    // Bouton START - Lance l'exécution du programme
    private startExecution(): void {
        if (this.isRunning) {
            console.log('Already running');
            return;
        }
        
        this.isRunning = true;
        this.displayMode = 'OUTPUT'; // En mode RUN, afficher le registre de sortie
        this.updateOutputDisplay();
        this.updateControlLeds(); // Allumer la LED RUN
        console.log('Execution started - Running at 1 instruction per second');
        
        // Démarrer le timer pour exécuter une instruction par seconde (1000ms)
        this.executionTimer = this.time.addEvent({
            delay: 250, // 250 millisecondes
            callback: this.executeCycle,
            callbackScope: this,
            loop: true // Répéter indéfiniment
        });
    }

    // Bouton STOP - Arrête l'exécution du programme
    private stopExecution(): void {
        if (!this.isRunning) {
            console.log('Already stopped');
            return;
        }
        
        this.isRunning = false;
        
        // Arrêter le timer d'exécution
        if (this.executionTimer) {
            this.executionTimer.destroy();
            this.executionTimer = null;
        }
        
        this.displayMode = 'OUTPUT'; // Continuer d'afficher le registre de sortie
        this.updateOutputDisplay();
        this.updateControlLeds(); // Éteindre la LED RUN
        console.log('Execution stopped');
    }


}