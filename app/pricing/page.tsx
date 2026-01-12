import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                SG
              </div>
              <span className="text-xl font-bold text-foreground">SecureGame</span>
            </Link>
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Tarification simple et transparente</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choisissez le plan qui convient le mieux à votre organisation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Formule Standard</CardTitle>
                <CardDescription>Pour les PME et petites équipes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-4xl font-bold text-foreground">Sur devis</p>
                  <p className="text-sm text-muted-foreground mt-2">Contact commercial pour les tarifs</p>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Jusqu'à 100 utilisateurs</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">10 scénarios inclus</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Support par email</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Rapports et statistiques</span>
                  </li>
                </ul>
                <Link href="/auth/register" className="block">
                  <Button className="w-full bg-transparent" variant="outline">
                    Demander une démo
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/50 border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Formule Enterprise</CardTitle>
                <CardDescription>Pour les grandes organisations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-4xl font-bold text-foreground">Sur devis</p>
                  <p className="text-sm text-muted-foreground mt-2">Tarification personnalisée</p>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Utilisateurs illimités</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Scénarios personnalisés</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Support prioritaire 24/7</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Intégrations personnalisées</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">SLA garanti</span>
                  </li>
                </ul>
                <Link href="/contact" className="block">
                  <Button className="w-full">Contacter les ventes</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
