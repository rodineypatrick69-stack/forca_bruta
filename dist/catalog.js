const suppliedCatalog = [
  {
    "label": "Porção Superior (Clavicular)",
    "exercises": [
      "Supino Inclinado com Barra",
      "Supino Inclinado com Halteres",
      "Supino Inclinado na Máquina Articulada",
      "Supino Inclinado no Smith",
      "Crucifixo Inclinado com Halteres",
      "Crucifixo Inclinado na Polia (Cabo Baixo)",
      "Fly Inclinado na Máquina",
      "Flexão de Braço com Pés Elevados"
    ],
    "muscle": "peitoral"
  },
  {
    "label": "Porção Média (Esternocostal / Foco Geral)",
    "exercises": [
      "Supino Reto com Barra",
      "Supino Reto com Halteres",
      "Supino Reto na Máquina Articulada",
      "Supino Reto no Smith",
      "Crucifixo Reto com Halteres",
      "Crucifixo Reto na Polia",
      "Voador / Pec Deck / Borboleta",
      "Flexão de Braço Tradicional",
      "Squeeze Press (Halteres espremidos contra o peito)"
    ],
    "muscle": "peitoral"
  },
  {
    "label": "Porção Inferior (Costal)",
    "exercises": [
      "Supino Declinado com Barra (Canadense)",
      "Supino Declinado com Halteres",
      "Crucifixo Declinado com Halteres",
      "Crossover na Polia Alta (Puxando de cima para baixo)",
      "Mergulho em Paralelas (Com o tronco inclinado para a frente)",
      "Flexão de Braço Declinada (Mãos elevadas em banco)"
    ],
    "muscle": "peitoral"
  },
  {
    "label": "Latíssimo do Dorso (Grande Dorso / Foco em Largura e \"Asas\")",
    "exercises": [
      "Barra Fixa Pronada (Pull-up)",
      "Puxada Alta Aberta na Polia (Pulldown)",
      "Puxada Alta com Triângulo (Pegada Neutra)",
      "Puxada Alta Supinada (Mãos invertidas)",
      "Puxada Unilateral na Polia",
      "Pull-over com Halter",
      "Pull-over na Polia Alta (Barra reta ou Corda)",
      "Puxada Articulada Convergente"
    ],
    "muscle": "dorsais"
  },
  {
    "label": "Romboides / Redondos / Trapézio Médio (Foco em Espessura e Miolo das Costas)",
    "exercises": [
      "Remada Curvada com Barra (Pronada ou Supinada)",
      "Remada Cavalinho (T-Bar Row)",
      "Remada Baixa com Triângulo na Polia",
      "Remada Unilateral com Halter (Serrote)",
      "Remada Articulada em Máquina",
      "Remada Pendlay (Barra saindo do chão a cada repetição)",
      "Remada Invertida (Peso corporal na barra ou fita)"
    ],
    "muscle": "romboides"
  },
  {
    "label": "Trapézio Superior",
    "exercises": [
      "Encolhimento de Ombros com Halteres",
      "Encolhimento de Ombros com Barra (Pela Frente ou por Trás)",
      "Encolhimento no Smith",
      "Remada Alta com Barra ou na Polia"
    ],
    "muscle": "trapezio"
  },
  {
    "label": "Eretores da Espinha (Lombar)",
    "exercises": [
      "Levantamento Terra Tradicional",
      "Levantamento Terra Sumô",
      "Extensão de Tronco (Banco Romano 45°)",
      "Bom Dia (Good Morning) com Barra nas costas"
    ],
    "muscle": "lombar"
  },
  {
    "label": "Deltoide Anterior (Parte da Frente)",
    "exercises": [
      "Desenvolvimento com Halteres (Sentado ou em Pé)",
      "Desenvolvimento Militar com Barra",
      "Desenvolvimento Arnold (Com rotação de punho)",
      "Desenvolvimento no Smith ou Máquina Articulada",
      "Elevação Frontal com Halteres (Alternada ou Simultânea)",
      "Elevação Frontal com Barra ou na Polia",
      "Elevação Frontal segurando Anilha"
    ],
    "muscle": "deltoide"
  },
  {
    "label": "Deltoide Lateral (Parte do Lado / Ombro Largo)",
    "exercises": [
      "Elevação Lateral com Halteres",
      "Elevação Lateral na Polia (Cabo)",
      "Elevação Lateral Sentado",
      "Elevação Lateral deitado de lado em banco inclinado",
      "Elevação Lateral na Máquina",
      "Remada Alta com Pegada Aberta"
    ],
    "muscle": "deltoide"
  },
  {
    "label": "Deltoide Posterior (Parte de Trás)",
    "exercises": [
      "Crucifixo Inverso com Halteres (Tronco Curvado para a frente)",
      "Voador Inverso / Peck Deck Inverso",
      "Face Pull (Polia Alta com Corda puxando em direção ao rosto)",
      "Crucifixo Inverso na Polia"
    ],
    "muscle": "deltoide"
  },
  {
    "label": "Quadríceps (Frente da Coxa)",
    "exercises": [
      "Agachamento Livre com Barra",
      "Agachamento Frontal (Front Squat)",
      "Agachamento no Smith / Hack Machine",
      "Leg Press 45°",
      "Leg Press Horizontal ou Inclinado",
      "Cadeira Extensora",
      "Agachamento Búlgaro",
      "Afundo com Halteres / Avanço Caminhando (Passada)",
      "Agachamento Sissy (Sissy Squat)",
      "Agachamento Goblet (Halter segurado à frente do peito)"
    ],
    "muscle": "quadriceps"
  },
  {
    "label": "Isquiotibiais / Posteriores (Trás da Coxa)",
    "exercises": [
      "Mesa Flexora (Deitado)",
      "Cadeira Flexora (Sentado)",
      "Flexora Vertical em Pé",
      "Stiff com Barra ou Halteres",
      "Levantamento Terra Romeno (Joelhos semi-flexionados)",
      "Flexão Nórdica (Peso corporal)"
    ],
    "muscle": "posteriores"
  },
  {
    "label": "Glúteos (Máximo, Médio e Mínimo)",
    "exercises": [
      "Elevação Pélvica com Barra (Hip Thrust) ou Máquina",
      "Extensão de Quadril na Polia (Coice)",
      "Cadeira Abdutora",
      "Abdução de Quadril na Polia (Cabo Lateral)",
      "Glúteo Quatro Apoios (Caneleira ou no Smith)"
    ],
    "muscle": "gluteos"
  },
  {
    "label": "Adutores (Parte Interna da Coxa)",
    "exercises": [
      "Cadeira Adutora",
      "Agachamento Sumô (Pés bem afastados para fora)",
      "Adução de Perna na Polia Baixa"
    ],
    "muscle": "adutores"
  },
  {
    "label": "Panturrilhas",
    "exercises": [
      "Gêmeos em Pé (Na máquina ou Smith)",
      "Gêmeos Sentado (Cavalo)",
      "Panturrilha/Gêmeos no Leg Press",
      "Gêmeos em Pé Unilateral com Halter"
    ],
    "muscle": "panturrilhas"
  },
  {
    "label": "Bíceps",
    "exercises": [
      "Rosca Direta (Barra Reta ou Barra W)",
      "Rosca Alternada com Halteres",
      "Rosca Scott (Com Barra W, Halter ou Máquina)",
      "Rosca Inclinada no Banco 45°",
      "Rosca Concentrada",
      "Rosca Direta na Polia (Cabo)",
      "Rosca Spider (Deitado de bruços no banco inclinado)"
    ],
    "muscle": "biceps"
  },
  {
    "label": "Braquial / Braquiorradial (Largura do Braço e Antebraço)",
    "exercises": [
      "Rosca Martelo com Halteres",
      "Rosca Martelo na Polia com Corda",
      "Rosca Inversa (Barra ou Polia - Palmas para baixo)",
      "Flexão de Punho (Flexores do antebraço)",
      "Extensão de Punho (Extensores do antebraço)"
    ],
    "muscle": "antebraco"
  },
  {
    "label": "Tríceps",
    "exercises": [
      "Tríceps na Polia (Com Barra Reta, Barra V ou Pegada Inversa)",
      "Tríceps na Polia com Corda",
      "Tríceps Testa (Com Barra W ou Halteres)",
      "Tríceps Francês (Sentado com halter bilateral ou unilateral)",
      "Tríceps Francês na Polia (Puxando de costas para o cabo)",
      "Supino com Pegada Fechada (Foco em Tríceps)",
      "Mergulho em Paralelas",
      "Mergulho no Banco",
      "Tríceps Coice (Com Halter ou na Polia)"
    ],
    "muscle": "triceps"
  },
  {
    "label": "Reto Abdominal (Geral / Infra / Supra)",
    "exercises": [
      "Abdominal Crunch Tradicional (Solo)",
      "Abdominal na Máquina com Carga / na Polia Alta (Ajoelhado)",
      "Elevação de Pernas Suspenso na Barra Fixa (Toes to Bar / Knee raised)",
      "Elevação de Pernas deitado no solo ou banco inclinado (Infra)",
      "Abdominal Canivete (V-Ups)"
    ],
    "muscle": "abdomen"
  },
  {
    "label": "Oblíquos (Laterais do Abdômen)",
    "exercises": [
      "Russian Twist (Giro Russo com carga)",
      "Abdominal Lateral no Banco Romano ou em Pé com Halter",
      "Woodchopper no Cabo (Movimento do lenhador na polia)"
    ],
    "muscle": "obliquos"
  },
  {
    "label": "Estabilização e Core Profundo (Transverso do Abdômen)",
    "exercises": [
      "Prancha Isométrica Frontal (Plank)",
      "Prancha Lateral (Isométrica ou Dinâmica)",
      "Stomach Vacuum (Vácuo Abdominal)",
      "Dead Bug (Inseto Morto)",
      "Farmer's Walk (Caminhada do fazendeiro segurando halteres pesados)"
    ],
    "muscle": "abdomen"
  }
];

