import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { AdminNavbar } from '../components/admin/AdminNavbar'
import { FormInput } from '../components/ui/FormInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { getAfiliadoById, actualizarAfiliado } from '../services/afiliadosService'
import { validarCampoRequerido, validarEmail } from '../utils/validators'
import type { TipoDocumento, GeneroAfiliado, EstadoAfiliado } from '../types'

interface CamposEditables {
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
  estado: EstadoAfiliado
}

type Errores = Partial<Record<keyof CamposEditables, string>>

export function EditarAfiliadoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [tipo, setTipo] = useState('')
  const [campos, setCampos] = useState<CamposEditables>({
    tipoDocumento: '', numeroDocumento: '',
    nombres: '', apellidos: '', genero: '', telefono: '',
    correo: '', fechaNacimiento: '', departamento: '', ciudad: '',
    ipsMedica: '', estado: 'activo',
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargandoDatos, setCargandoDatos] = useState(true)

  useEffect(() => {
    if (!id) return
    getAfiliadoById(id).then(af => {
      if (!af) { navigate('/admin/afiliados'); return }
      setTipo(af.tipo)
      setCampos({
        tipoDocumento: af.tipoDocumento,
        numeroDocumento: af.numeroDocumento,
        nombres: af.nombres,
        apellidos: af.apellidos,
        genero: af.genero,
        telefono: af.telefono,
        correo: af.correo,
        fechaNacimiento: af.fechaNacimiento,
        departamento: af.departamento,
        ciudad: af.ciudad,
        ipsMedica: af.ipsMedica,
        estado: af.estado,
      })
      setCargandoDatos(false)
    })
  }, [id, navigate])

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setCampos(prev => ({ ...prev, [name]: value }))
    setErrores(prev => ({ ...prev, [name]: undefined }))
  }

  function validar(): boolean {
    const e: Errores = {}
    if (!campos.tipoDocumento) e.tipoDocumento = 'Selecciona el tipo de documento'
    const errNum = validarCampoRequerido(campos.numeroDocumento)
    if (errNum) e.numeroDocumento = errNum
    const errNombres = validarCampoRequerido(campos.nombres)
    if (errNombres) e.nombres = errNombres
    const errApellidos = validarCampoRequerido(campos.apellidos)
    if (errApellidos) e.apellidos = errApellidos
    if (!campos.genero) e.genero = 'Selecciona el género'
    const errTel = validarCampoRequerido(campos.telefono)
    if (errTel) e.telefono = errTel
    const errCorreo = validarCampoRequerido(campos.correo)
    if (errCorreo) e.correo = errCorreo
    else if (!validarEmail(campos.correo)) e.correo = 'Ingresa un correo válido'
    const errFecha = validarCampoRequerido(campos.fechaNacimiento)
    if (errFecha) e.fechaNacimiento = errFecha
    const errDep = validarCampoRequerido(campos.departamento)
    if (errDep) e.departamento = errDep
    const errCiudad = validarCampoRequerido(campos.ciudad)
    if (errCiudad) e.ciudad = errCiudad
    const errIps = validarCampoRequerido(campos.ipsMedica)
    if (errIps) e.ipsMedica = errIps
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorGeneral('')
    if (!validar() || !id) return
    setCargando(true)
    const resultado = await actualizarAfiliado(id, {
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
      estado: campos.estado,
    })
    setCargando(false)
    if (resultado.ok) {
      navigate('/admin/afiliados')
    } else {
      setErrorGeneral(resultado.error ?? 'Error al actualizar afiliado.')
    }
  }

  if (cargandoDatos) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AdminNavbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-muted-foreground text-sm">Cargando datos del afiliado...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Editar Afiliado</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {tipo === 'cotizante' ? 'Cotizante' : 'Beneficiario'}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Datos del Afiliado</CardTitle>
            <CardDescription>El tipo y número de documento pueden modificarse con cuidado</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-3">

              {/* Tipo y Número de documento (ahora editables) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tipoDocumento">Tipo doc. <span className="text-destructive">*</span></Label>
                  <Select
                    id="tipoDocumento"
                    name="tipoDocumento"
                    value={campos.tipoDocumento}
                    onChange={handleChange}
                    placeholder="-- Tipo --"
                  >
                    <SelectItem value="CC">CC — Cédula de ciudadanía</SelectItem>
                    <SelectItem value="TI">TI — Tarjeta de identidad</SelectItem>
                    <SelectItem value="PA">PA — Pasaporte</SelectItem>
                    <SelectItem value="CE">CE — Cédula de extranjería</SelectItem>
                  </Select>
                  {errores.tipoDocumento && (
                    <p className="text-xs text-destructive">{errores.tipoDocumento}</p>
                  )}
                </div>
                <FormInput
                  label="Número de documento *"
                  name="numeroDocumento"
                  type="text"
                  value={campos.numeroDocumento}
                  onChange={handleChange}
                  error={errores.numeroDocumento}
                  required
                />
              </div>

              {/* Nombres y Apellidos */}
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Nombres *" name="nombres" type="text" value={campos.nombres} onChange={handleChange} error={errores.nombres} required />
                <FormInput label="Apellidos *" name="apellidos" type="text" value={campos.apellidos} onChange={handleChange} error={errores.apellidos} required />
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

              {/* Fecha y Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Fecha de nacimiento *" name="fechaNacimiento" type="date" value={campos.fechaNacimiento} onChange={handleChange} error={errores.fechaNacimiento} required />
                <FormInput label="Teléfono *" name="telefono" type="tel" value={campos.telefono} onChange={handleChange} error={errores.telefono} required />
              </div>

              {/* Correo */}
              <FormInput label="Correo electrónico *" name="correo" type="email" value={campos.correo} onChange={handleChange} error={errores.correo} required />

              {/* Departamento y Ciudad */}
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Departamento *" name="departamento" type="text" value={campos.departamento} onChange={handleChange} error={errores.departamento} required />
                <FormInput label="Ciudad *" name="ciudad" type="text" value={campos.ciudad} onChange={handleChange} error={errores.ciudad} required />
              </div>

              {/* IPS */}
              <FormInput label="IPS Médica *" name="ipsMedica" type="text" value={campos.ipsMedica} onChange={handleChange} error={errores.ipsMedica} required />

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
                  {cargando ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
