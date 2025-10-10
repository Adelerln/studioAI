export const navigationLinks = [
  { label: 'Product', href: '#product' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Developers', href: '#developers' },
  { label: 'Pricing', href: '#pricing' }
];

export const heroContent = {
  eyebrow: 'Studio AI',
  title: 'Transformez la création visuelle de votre équipe',
  subtitle:
    "La plateforme pour prototyper, valider et déployer des expériences IA en quelques minutes. Connectez vos données, orchestrez les meilleurs modèles et livrez des rendus dignes d'une direction artistique.",
  primaryCta: { label: 'Get started', href: '/signup' },
  secondaryCta: { label: 'Book a demo', href: '/contact' },
  mediaCaption: 'Workspace collaboratif — aperçu du flux Studio AI'
};

export const featureCards = [
  {
    id: 'workflow',
    title: 'Workflows orchestrés',
    description:
      'Assemblez prompts, évaluations et post-traitements dans un canevas visuel. Versionnez et publiez chaque pipeline en un clic.',
    accent: 'linear-gradient(135deg, #5b8df7, #90b2ff)'
  },
  {
    id: 'collaboration',
    title: 'Collaboration temps réel',
    description:
      'Validez les itérations avec votre équipe. Historique des discussions, annotations partagées et gestion des accès intégrée.',
    accent: 'linear-gradient(135deg, #f97362, #fdb18e)'
  },
  {
    id: 'delivery',
    title: 'Livraison sécurisée',
    description:
      'Déployez vos agents créatifs sur vos canaux internes ou publics. Monitoring, journaux d’exécution et alertes automatiques.',
    accent: 'linear-gradient(135deg, #66d28a, #a3f0c0)'
  }
];

export const securityPillars = [
  {
    title: 'Data privacy',
    description:
      'Vos données restent vos données — jamais utilisées pour entraîner nos modèles. Chiffrement au repos et en transit par défaut.',
    accent: { background: '#4F7BF7', shape: 'radial-gradient(circle at 50% 0%, #9CC7FF 0%, transparent 70%)' }
  },
  {
    title: 'Access control',
    description:
      'Permissions granulaires, prise en charge SSO/SCIM, scopes API et politiques adaptées à chaque équipe.',
    accent: { background: '#FF5C5C', shape: 'conic-gradient(from 90deg, #FFD2D2 0deg, transparent 180deg)' }
  },
  {
    title: 'Compliance',
    description:
      'Conforme SOC 2 Type II et RGPD. Journaux d’audit, options de résidence des données et réponses aux exigences HIPAA.',
    accent: { background: '#C3E764', shape: 'linear-gradient(180deg, transparent 40%, #4B8B3B 100%)' }
  }
];

export const useCasesColumns = [
  {
    heading: 'Marketing',
    badge: { label: 'Qonto', highlight: '70% de temps gagné' },
    points: [
      'Produisez des campagnes multi-format cohérentes',
      'Alignez vos équipes locales en quelques minutes',
      'Générez des visuels respectant votre charte'
    ],
    tone: { background: '#FFF6D8', border: '#F1C670' }
  },
  {
    heading: 'Sales',
    badge: { label: 'Clay', highlight: 'Adopté en 2 semaines' },
    points: [
      'Préparez des présentations personnalisées par compte',
      'Créez des démos produits réalistes à partir de vos données',
      'Automatisez la veille concurrentielle et la synthèse'
    ],
    tone: { background: '#FFE5F2', border: '#F199C7' }
  },
  {
    heading: 'Support',
    badge: { label: 'Malt', highlight: '-50% temps de résolution' },
    points: [
      'Générez des tutoriels contextualisés à partir des tickets',
      'Détectez les points de friction récurrents automatiquement',
      'Déployez des agents répondant en langage naturel'
    ],
    tone: { background: '#E6F4FF', border: '#86B8F6' }
  }
];
