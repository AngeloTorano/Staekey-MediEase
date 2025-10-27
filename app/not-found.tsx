import Link from "next/link"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-3xl w-full text-center">
        <div className="inline-flex items-center justify-center mb-6 p-4 rounded-full bg-primary/10">
          <Heart className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-6xl font-extrabold tracking-tight mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Page not found</h2>
        <p className="text-muted-foreground mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. If you entered the web address manually, double-check the URL.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost">Return Home</Button>
          </Link>
          <a href="mailto:help@mediease.local" className="inline-block">
            <Button variant="outline">Contact Support</Button>
          </a>
        </div>

        <div className="mt-10 text-sm text-muted-foreground">
          <p>If you think this is an error, please contact the system administrator.</p>
        </div>
      </div>
    </main>
  )
}
