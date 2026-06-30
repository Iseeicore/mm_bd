import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import * as ctrlRegistro from '../../controllers/registro.js';

const router = Router();

router.post('/', manejoErrores(ctrlRegistro.registrar));

export default router;
