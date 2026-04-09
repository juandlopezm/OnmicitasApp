import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../services/authService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormInput } from '@/components/ui/FormInput'
import { Select, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { validarEmail, validarCampoRequerido } from '../utils/validators'
import type { TipoDocumento } from '../types'
import { Heart } from 'lucide-react'

const TIPOS_DOCUMENTO: { value: TipoDocumento; label: string }[] = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'PA', label: 'Pasaporte' },
]

interface Campos {
  tipoDocumento: TipoDocumento | ''
  numeroDocumento: string
  nombre: string
  email: string
  confirmarEmail: string
  password: string
  confirmarPassword: string
}

interface Errores {
  tipoDocumento?: string
  numeroDocumento?: string
  nombre?: string
  email?: string
  confirmarEmail?: string
  password?: string
  confirmarPassword?: string
}

const camposIniciales: Campos = {
  tipoDocumento: '',
  numeroDocumento: '',
  nombre: '',
  email: '',
  confirmarEmail: '',
  password: '',
  confirmarPassword: '',
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [campos, setCampos] = useState<Campos>(camposIniciales)
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [cargando, setCargando] = useState(false)

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setCampos(prev => ({ ...prev, [name]: value }))
    // Limpiar error del campo que se está editando
    setErrores(prev => ({ ...prev, [name]: undefined }))
  }

  function validar(): boolean {
    const e: Errores = {}

    if (!campos.tipoDocumento) e.tipoDocumento = 'Selecciona un tipo de documento'

    const errDoc = validarCampoRequerido(campos.numeroDocumento)
    if (errDoc) {
      e.numeroDocumento = errDoc
    } else if (!/^\d+$/.test(campos.numeroDocumento)) {
      e.numeroDocumento = 'Solo se permiten números'
    }

    const errNombre = validarCampoRequerido(campos.nombre)
    if (errNombre) e.nombre = errNombre

    const errEmail = validarCampoRequerido(campos.email)
    if (errEmail) {
      e.email = errEmail
    } else if (!validarEmail(campos.email)) {
      e.email = 'Ingresa un correo válido'
    }

    if (!campos.confirmarEmail) {
      e.confirmarEmail = 'Confirma tu correo'
    } else if (campos.email !== campos.confirmarEmail) {
      e.confirmarEmail = 'Los correos no coinciden'
    }

    const errPass = validarCampoRequerido(campos.password)
    if (errPass) {
      e.password = errPass
    } else if (campos.password.length < 6) {
      e.password = 'Mínimo 6 caracteres'
    }

    if (!campos.confirmarPassword) {
      e.confirmarPassword = 'Confirma tu contraseña'
    } else if (campos.password !== campos.confirmarPassword) {
      e.confirmarPassword = 'Las contraseñas no coinciden'
    }

    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorGeneral('')

    if (!validar()) return

    setCargando(true)
    const resultado = await register({
      tipo_documento: campos.tipoDocumento as TipoDocumento,
      numero_documento: campos.numeroDocumento,
      correo: campos.email,
      password: campos.password,
    })
    setCargando(false)

    if (resultado.ok) {
      navigate('/login', { state: { registrado: true } })
    } else {
      setErrorGeneral(resultado.error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground mb-3">
            <Heart className="size-6 fill-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">OmniCitas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea tu cuenta para agendar citas médicas
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Crear cuenta</CardTitle>
            <CardDescription>Completa el formulario para registrarte</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-1">

              {/* Tipo de documento */}
              <div className="flex flex-col gap-1.5 mb-4">
                <Label htmlFor="tipoDocumento">
                  Tipo de documento
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Select
                  id="tipoDocumento"
                  name="tipoDocumento"
                  value={campos.tipoDocumento}
                  onChange={handleChange}
                  placeholder="-- Selecciona --"
                >
                  {TIPOS_DOCUMENTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </Select>
                {errores.tipoDocumento && (
                  <p className="text-sm text-destructive">{errores.tipoDocumento}</p>
                )}
              </div>

              {/* Número de documento */}
              <FormInput
                label="Número de documento"
                name="numeroDocumento"
                type="text"
                inputMode="numeric"
                value={campos.numeroDocumento}
                onChange={handleChange}
                error={errores.numeroDocumento}
                placeholder="Ej: 1234567890"
                required
              />

              {/* Nombre completo */}
              <FormInput
                label="Nombre completo"
                name="nombre"
                type="text"
                value={campos.nombre}
                onChange={handleChange}
                error={errores.nombre}
                placeholder="Ej: Carlos Pérez"
                required
              />

              {/* Correo */}
              <FormInput
                label="Correo electrónico"
                name="email"
                type="email"
                value={campos.email}
                onChange={handleChange}
                error={errores.email}
                placeholder="ejemplo@correo.com"
                required
              />

              {/* Confirmar correo */}
              <FormInput
                label="Confirmar correo"
                name="confirmarEmail"
                type="email"
                value={campos.confirmarEmail}
                onChange={handleChange}
                error={errores.confirmarEmail}
                placeholder="Repite tu correo"
                required
              />

              {/* Contraseña */}
              <FormInput
                label="Contraseña"
                name="password"
                type="password"
                value={campos.password}
                onChange={handleChange}
                error={errores.password}
                placeholder="Mínimo 6 caracteres"
                required
              />

              {/* Confirmar contraseña */}
              <FormInput
                label="Confirmar contraseña"
                name="confirmarPassword"
                type="password"
                value={campos.confirmarPassword}
                onChange={handleChange}
                error={errores.confirmarPassword}
                placeholder="Repite tu contraseña"
                required
              />

              {/* Error general */}
              {errorGeneral && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {errorGeneral}
                </p>
              )}

              <Button type="submit" className="w-full !mt-4" disabled={cargando}>
                {cargando ? 'Registrando...' : 'Crear cuenta'}
              </Button>
            </form>

            {/* Link a login */}
            <p className="text-center text-sm text-muted-foreground mt-4">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
