import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlReporte from '../../controllers/reporte.js';

const router = Router();

router.get('/historial-stock/:productoId', requireAuth, requirePermiso('reportes.read'), manejoErrores(ctrlReporte.historialStock));
router.get('/mas-vendidos',                requireAuth, requirePermiso('reportes.read'), manejoErrores(ctrlReporte.masVendidos));
router.get('/trazabilidad',                requireAuth, requirePermiso('reportes.read'), manejoErrores(ctrlReporte.trazabilidad));
router.get('/trazabilidad/resumen',        requireAuth, requirePermiso('reportes.read'), manejoErrores(ctrlReporte.trazabilidadResumen));

export default router;
