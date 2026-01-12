import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Shield, Users, BarChart3, Lock, Zap, Globe } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                CA
              </div>
              <span className="text-xl font-bold text-foreground">CyberAegis</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/features" className="text-sm text-foreground hover:text-primary transition">
                Fonctionnalités
              </Link>
              <Link href="/pricing" className="text-sm text-foreground hover:text-primary transition">
                Tarifs
              </Link>
              <Link href="/security" className="text-sm text-foreground hover:text-primary transition">
                Sécurité
              </Link>
              <Link href="/contact" className="text-sm text-foreground hover:text-primary transition">
                Contact
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  Se connecter
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm">Demander une démo</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 text-balance">
              Sensibilisez vos équipes à la <span className="text-primary">cybersécurité</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 text-balance">
              La plateforme SaaS d'escape game cybersécurité pour former et engager vos collaborateurs. Déploiement
              immédiat, résultats mesurables avec CyberAegis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register">
                <Button size="lg">Demander une démo</Button>
              </Link>
              <Link href="/features">
                <Button size="lg" variant="outline">
                  Découvrir
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-card/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Pourquoi CyberAegis ?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Une solution complète pour transformer la sensibilisation à la cybersécurité en expérience engageante
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle>Sensibilisation efficace</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Engagez vos équipes avec des scénarios d'escape game réalistes basés sur des incidents cybersécurité
                  actuels.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Globe className="h-6 w-6" />
                </div>
                <CardTitle>Déploiement SaaS</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Infrastructure cloud multi-tenant avec des machines virtuelles éphémères et isolées pour chaque
                  session.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <CardTitle>Rapports détaillés</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Collectez la télémétrie complète des sessions et générez des KPI pour mesurer l'impact de la
                  formation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">La plateforme SaaS</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour gérer les sessions d'escape game cybersécurité
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gestion des sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Création et planification facile
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Scénarios rejouables et paramétrables
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Suivi en temps réel des joueurs
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gestion des utilisateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Architecture multi-tenant
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Rôles et permissions granulaires
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Traçabilité complète des actions
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-card/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Sécurité & Conformité</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Votre sécurité et celle de vos données sont au cœur de notre plateforme
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Lock className="h-6 w-6" />
                </div>
                <CardTitle>Isolation des environnements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Chaque session dispose de sa propre infrastructure isolée et sécurisée.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Shield className="h-6 w-6" />
                </div>
                <CardTitle>Environnements éphémères</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Les VMs sont automatiquement supprimées après chaque session pour garantir la confidentialité.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <CardTitle>Conformité RGPD</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Plateforme certifiée et conforme à toutes les régulations de protection des données.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Prêt à transformer votre sensibilisation ?</h2>
          <p className="text-lg mb-8 opacity-90">
            Demandez une démo personnalisée et découvrez comment CyberAegis peut engager vos équipes
          </p>
          <Link href="/auth/register">
            <Button size="lg" variant="secondary">
              Demander une démo
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  CA
                </div>
                <span className="text-lg font-bold">CyberAegis</span>
              </div>
              <p className="text-sm text-muted-foreground">Plateforme SaaS d'escape game cybersécurité</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/features" className="text-muted-foreground hover:text-foreground">
                    Fonctionnalités
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                    Tarifs
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="text-muted-foreground hover:text-foreground">
                    Sécurité
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Entreprise</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                    Contact
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground">
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-foreground">Légal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground">
                    Politique de confidentialité
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground">
                    Conditions d'utilisation
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 CyberAegis. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
