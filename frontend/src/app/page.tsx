import LandingPage from '@/components/landing/LandingPage'

export const metadata = {
  title: 'Kalma — Software de gestión para gimnasios y estudios fitness',
  description:
    'Kalma centraliza clientes, membresías, agenda y cobros en un solo lugar. Diseñado para gimnasios, estudios de Pilates, Barre y centros de acondicionamiento físico en Colombia.',
  openGraph: {
    title: 'Kalma — Software de gestión para gimnasios y estudios fitness',
    description: 'Gestión inteligente para tu estudio. Membresías, agenda, cobros y caja en una sola plataforma.',
    url: 'https://usekalma.com',
    siteName: 'Kalma',
    locale: 'es_CO',
    type: 'website',
  },
}

export default function RootPage() {
  return <LandingPage />
}
