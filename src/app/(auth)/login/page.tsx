'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/5 border-white/10 text-white">
        <CardHeader className="text-center">
          <div className="text-3xl font-bold mb-1">VentasIA</div>
          <CardTitle className="text-xl">Iniciar sesión</CardTitle>
          <CardDescription className="text-gray-400">Accede a tu dashboard de ventas IA</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
              />
            </div>
            <Button type="submit" className="w-full bg-purple-500 hover:bg-purple-600" disabled={loading}>
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </Button>
          </form>
          <p className="text-center text-gray-400 mt-4 text-sm">
            ¿No tienes cuenta?{' '}
            <Link href="/signup" className="text-purple-400 hover:underline">
              Regístrate gratis
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
