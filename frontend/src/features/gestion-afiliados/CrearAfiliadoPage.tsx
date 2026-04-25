import { useState, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AdminNavbar } from '../../layout/AdminNavbar'
import { FormInput } from '../../components/ui/FormInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { crearAfiliado, getAfiliados } from './services/afiliadosService'
import { validarCampoRequerido, validarEmail } from '../../utils/validators'
import type { TipoDocumento, GeneroAfiliado, EstadoAfiliado, TipoAfiliado, Afiliado } from '../../types'
import { useEffect } from 'react'

interface Campos {
  tipoDocumento: TipoDocumento | ''
  numeroDocumento: string
  nombres: string
  apellidos: string
  genero: GeneroAfiliado | ''
  telefono: string
  correo: string
  fechaNacimiento: string
  departamento: string
  ciudad: string
  ipsMedica: string
  tipo: TipoAfiliado | ''
  cotizanteId: string
  estado: EstadoAfiliado
}

type Errores = Partial<Record<keyof Campos, string>>

const camposIniciales: Campos = {
  tipoDocumento: '',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  genero: '',
  telefono: '',
  correo: '',
  fechaNacimiento: '',
  departamento: '',
  ciudad: '',
  ipsMedica: '',
  tipo: '',
  cotizanteId: '',
  estado: 'activo',
}

export function CrearAfiliadoPage() {
  const navigate = useNavigate()
  const [campos, setCampos] = useState<Campos>(camposIniciales)
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cotizantes, setCotizantes] = useState<Afiliado[]>([])

  useEffect(() => {
    getAfiliados().then(all => setCotizantes(all.filter(a => a.tipo === 'cotizante')))
  }, [])

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setCampos(prev => ({ ...prev, [name]: value }))
    setErrores(prev => ({ ...prev, [name]: undefined }))
  }

  function validar(): boolean {
    const e: Errores = {}
    if (!campos.tipoDocumento) e.tipoDocumento = 'Selecciona un tipo de documento'
    const errDoc = validarCampoRequerido(campos.numeroDocumento)
    if (errDoc) e.numeroDocumento = errDoc
    else if (!/^\d+$/.test(campos.numeroDocumento)) e.numeroDocumento = 'Solo se permiten números'
    const errNombres = validarCampoRequerido(campos.nombres)
    if (errNombres) e.nombres = errNombres
    const errApellidos = validarCampoRequerido(campos.apellidos)
    if (errApellidos) e.apellidos = errApellidos
    if (!campos.genero) e.genero = 'Selecciona el género'
    const errTel = validarCampoRequerido(campos.telefono)
    if (errTel) e.telefono = errTel
    if (campos.tipo !== 'beneficiario') {
      const errCorreo = validarCampoRequerido(campos.correo)
      if (errCorreo) e.correo = errCorreo
      else if (!validarEmail(campos.correo)) e.correo = 'Ingresa un correo válido'
    } else if (campos.correo && !validarEmail(campos.correo)) {
      e.correo = 'Ingresa un correo válido'
    }
    const errFecha = validarCampoRequerido(campos.fechaNacimiento)
    if (errFecha) e.fechaNacimiento = errFecha
    const errDep = validarCampoRequerido(campos.departamento)
    if (errDep) e.departamento = errDep
    const errCiudad = validarCampoRequerido(campos.ciudad)
    if (errCiudad) e.ciudad = errCiudad
    const errIps = validarCampoRequerido(campos.ipsMedica)
    if (errIps) e.ipsMedica = errIps
    if (!campos.tipo) e.tipo = 'Selecciona el tipo de afiliado'
    if (campos.tipo === 'beneficiario' && !campos.cotizanteId) {
      e.cotizanteId = 'Selecciona el cotizante al que pertenece'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorGeneral('')
    if (!validar()) return
    setCargando(true)
    const resultado = await crearAfiliado({
      tipoDocumento: campos.tipoDocumento as TipoDocumento,
      numeroDocumento: campos.numeroDocumento,
      nombres: campos.nombres,
      apellidos: campos.apellidos,
      genero: campos.genero as GeneroAfiliado,
      telefono: campos.telefono,
      correo: campos.correo,
      fechaNacimiento: campos.fechaNacimiento,
      departamento: campos.departamento,
      ciudad: campos.ciudad,
      ipsMedica: campos.ipsMedica,
      tipo: campos.tipo as TipoAfiliado,
      cotizanteId: campos.tipo === 'beneficiario' ? campos.cotizanteId : undefined,
      estado: campos.estado,
    })
    setCargando(false)
    if (resultado.ok) {
      navigate('/admin/afiliados')
    } else {
      setErrorGeneral(resultado.error ?? 'Error al crear afiliado.')
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Nuevo Afiliado</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Completa la información del afiliado</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Datos del Afiliado</CardTitle>
            <CardDescription>Todos los campos marcados con * son obligatorios</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-3">

              {/* Tipo y Número de Documento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tipoDocumento">Tipo doc. <span className="text-destructive">*</span></Label>
                  <Select id="tipoDocumento" name="tipoDocumento" value={campos.tipoDocumento} onChange={handleChange} placeholder="-- Tipo --">
                    <SelectItem value="CC">CC</SelectItem>
                    <SelectItem value="TI">TI</SelectItem>
                    <SelectItem value="CE">CE</SelectItem>
                    <SelectItem value="PA">PA</SelectItem>
                  </Select>
                  {errores.tipoDocumento && <p className="text-xs text-destructive">{errores.tipoDocumento}</p>}
                </div>
                <FormInput label="Número de documento *" name="numeroDocumento" type="text" inputMode="numeric" value={campos.numeroDocumento} onChange={handleChange} error={errores.numeroDocumento} placeholder="Ej: 1234567890" required />
              </div>

              {/* Nombres y Apellidos */}
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Nombres *" name="nombres" type="text" value={campos.nombres} onChange={handleChange} error={errores.nombres} placeholder="Ej: Carlos" required />
                <FormInput label="Apellidos *" name="apellidos" type="text" value={campos.apellidos} onChange={handleChange} error={errores.apellidos} placeholder="Ej: Pérez" required />
              </div>

              {/* Género */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="genero">Género <span className="text-destructive">*</span></Label>
                <Select id="genero" name="genero" value={campos.genero} onChange={handleChange} placeholder="-- Selecciona --">
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                  <SelectItem value="O">Otro</SelectItem>
                </Select>
                {errores.genero && <p className="text-xs text-destructive">{errores.genero}</p>}
              </div>

              {/* Fecha de nacimiento y Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Fecha de nacimiento *" name="fechaNacimiento" type="date" value={campos.fechaNacimiento} onChange={handleChange} error={errores.fechaNacimiento} required />
                <FormInput label="Teléfono *" name="telefono" type="tel" value={campos.telefono} onChange={handleChange} error={errores.telefono} placeholder="Ej: 3001234567" required />
              </div>

              {/* Correo */}
              <FormInput
                label={campos.tipo === 'beneficiario' ? 'Correo electrónico (opcional)' : 'Correo electrónico *'}
                name="correo"
                type="email"
                value={campos.correo}
                onChange={handleChange}
                error={errores.correo}
                placeholder="ejemplo@correo.com"
                required={campos.tipo !== 'beneficiario'}
              />

              {/* Departamento y Ciudad */}
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Departamento *" name="departamento" type="text" value={campos.departamento} onChange={handleChange} error={errores.departamento} placeholder="Ej: Cundinamarca" required />
                <FormInput label="Ciudad *" name="ciudad" type="text" value={campos.ciudad} onChange={handleChange} error={errores.ciudad} placeholder="Ej: Bogotá" required />
              </div>

              {/* IPS Médica */}
              <FormInput label="IPS Médica *" name="ipsMedica" type="text" value={campos.ipsMedica} onChange={handleChange} error={errores.ipsMedica} placeholder="Ej: Clínica San Rafael" required />

              {/* Tipo de afiliado */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tipo">Tipo de afiliado <span className="text-destructive">*</span></Label>
                <Select id="tipo" name="tipo" value={campos.tipo} onChange={handleChange} placeholder="-- Selecciona --">
                  <SelectItem value="cotizante">Cotizante</SelectItem>
                  <SelectItem value="beneficiario">Beneficiario</SelectItem>
                </Select>
                {errores.tipo && <p className="text-xs text-destructive">{errores.tipo}</p>}
              </div>

              {/* Cotizante (solo si beneficiario) */}
              {campos.tipo === 'beneficiario' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cotizanteId">Cotizante al que pertenece <span className="text-destructive">*</span></Label>
                  <Select id="cotizanteId" name="cotizanteId" value={campos.cotizanteId} onChange={handleChange} placeholder="-- Selecciona cotizante --">
                    {cotizantes.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombres} {c.apellidos} — {c.tipoDocumento} {c.numeroDocumento}
                      </SelectItem>
                    ))}
                  </Select>
                  {cotizantes.length === 0 && (
                    <p className="text-xs text-muted-foreground">No hay cotizantes registrados aún.</p>
                  )}
                  {errores.cotizanteId && <p className="text-xs text-destructive">{errores.cotizanteId}</p>}
                </div>
              )}

              {/* Estado */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="estado">Estado</Label>
                <Select id="estado" name="estado" value={campos.estado} onChange={handleChange} placeholder="">
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="suspendido">Suspendido</SelectItem>
                </Select>
              </div>

              {errorGeneral && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {errorGeneral}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" asChild>
                  <Link to="/admin/afiliados">Cancelar</Link>
                </Button>
                <Button type="submit" disabled={cargando} className="flex-1">
                  {cargando ? 'Guardando...' : 'Crear Afiliado'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
