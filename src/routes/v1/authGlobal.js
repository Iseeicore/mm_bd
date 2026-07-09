import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import * as ctrlAuth from '../../controllers/auth.js';

const router = Router();

router.get('/empresas', manejoErrores(ctrlAuth.empresasPorEmail));

export default router;
