export const navigationLinks = [
  { label: 'Pricing', href: '/pricing' }
];

type Cta = { label: string; href: string };

interface HeroContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  mediaCaption: string;
}

export const heroContent: HeroContent = {
  eyebrow: 'Studio AI',
  title: "Reimagine your team's visual production",
  subtitle:
    'Prototype, validate, and deploy AI-powered visual experiences in minutes. Connect your data, orchestrate the best models, and ship results that meet creative direction standards.',
  secondaryCta: { label: 'Voir les offres', href: '/pricing' },
  mediaCaption: 'Collaborative workspace — Studio AI flow preview'
};

export const featureCards = [
  {
    id: 'workflow',
    title: 'Orchestrated workflows',
    description:
      'Assemble prompts, evaluations, and post-processing in a visual canvas. Version and publish each pipeline in one click.',
    accent: 'linear-gradient(135deg, #5b8df7, #90b2ff)'
  },
  {
    id: 'collaboration',
    title: 'Real-time collaboration',
    description:
      'Review iterations with your team. Shared annotations, discussion history, and granular access management built in.',
    accent: 'linear-gradient(135deg, #f97362, #fdb18e)'
  },
  {
    id: 'delivery',
    title: 'Secure delivery',
    description:
      'Deploy creative agents to internal or public channels. Monitoring, execution logs, and automated alerts included.',
    accent: 'linear-gradient(135deg, #66d28a, #a3f0c0)'
  }
];

export const securityPillars = [
  {
    title: 'Data privacy',
    description:
      'Your data stays yours—never used to train our models. Encryption at rest and in transit is enabled by default.',
    accent: { background: '#4F7BF7', shape: 'radial-gradient(circle at 50% 0%, #9CC7FF 0%, transparent 70%)' }
  },
  {
    title: 'Access control',
    description: 'Granular permissions, SSO/SCIM support, API scopes, and policies tailored to every team.',
    accent: { background: '#FF5C5C', shape: 'conic-gradient(from 90deg, #FFD2D2 0deg, transparent 180deg)' }
  },
  {
    title: 'Compliance',
    description:
      'SOC 2 Type II and GDPR compliant. Audit logs, data residency options, and HIPAA-ready safeguards.',
    accent: { background: '#C3E764', shape: 'linear-gradient(180deg, transparent 40%, #4B8B3B 100%)' }
  }
];

export const useCasesColumns = [
  {
    heading: 'Marketing',
    badge: { label: 'Qonto', highlight: '70% faster localization' },
    points: [
      'Produce cohesive multi-format campaigns',
      'Align regional teams in minutes',
      'Generate on-brand visuals automatically'
    ],
    tone: { background: '#FFF6D8', border: '#F1C670' }
  },
  {
    heading: 'Sales',
    badge: { label: 'Clay', highlight: 'Adopted in 2 weeks' },
    points: [
      'Prepare account-personalized presentations',
      'Create realistic product demos from your data',
      'Automate competitive research and synthesis'
    ],
    tone: { background: '#FFE5F2', border: '#F199C7' }
  },
  {
    heading: 'Support',
    badge: { label: 'Malt', highlight: '50% faster resolution' },
    points: [
      'Generate contextual tutorials from tickets',
      'Automatically spot recurring friction points',
      'Deploy natural-language agents for responses'
    ],
    tone: { background: '#E6F4FF', border: '#86B8F6' }
  }
];
