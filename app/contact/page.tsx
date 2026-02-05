import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                CA
              </div>
              <span className="text-xl font-bold text-foreground">CyberAegis</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/features" className="text-sm text-foreground hover:text-primary transition">
                Fonctionnalites
              </Link>
              <Link href="/pricing" className="text-sm text-foreground hover:text-primary transition">
                Tarifs
              </Link>
              <Link href="/security" className="text-sm text-foreground hover:text-primary transition">
                Securite
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
                <Button size="sm">Demander une demo</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Contactez-nous</h1>
            <p className="text-lg text-muted-foreground">Nous répondons à toutes les questions dans les 24 heures</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Formulaire de contact</CardTitle>
              <CardDescription>Remplissez le formulaire ci-dessous et nous vous recontacterons</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium text-foreground">
                      Nom
                    </label>
                    <Input id="name" placeholder="Votre nom" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-foreground">
                      Email professionnel
                    </label>
                    <Input id="email" type="email" placeholder="you@company.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="company" className="text-sm font-medium text-foreground">
                    Entreprise
                  </label>
                  <Input id="company" placeholder="Nom de votre entreprise" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium text-foreground">
                    Message
                  </label>
                  <Textarea id="message" placeholder="Votre message..." rows={6} />
                </div>
                <Button className="w-full">Envoyer</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
