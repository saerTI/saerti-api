import { Router } from 'express';
import { body } from 'express-validator';
import { clerkAuth as authenticate } from '../../middleware/clerkAuth.mjs';
import {
    getEmpleados,
    getEmpleadoById,
    createEmpleado,
    updateEmpleado,
    deleteEmpleado
} from '../../controllers/CC/empleadosController.mjs';

const router = Router();

/**
 * @route   GET /api/empleados
 * @desc    Obtener todos los empleados con filtros y paginación
 * @access  Privado
 * */
router.get('/api/empleados', authenticate, getEmpleados);

/**
 * @route   GET /api/empleados/:id
 * @desc    Obtener un empleado por ID
 * @access  Privado
 * */
router.get('/api/empleados/:id', authenticate, getEmpleadoById);

/**
 * @route   POST /api/empleados
 * @desc    Crear un nuevo empleado
 * @access  Privado
 * */
router.post('/api/empleados', authenticate, [
    body('full_name').notEmpty().withMessage('El nombre completo es obligatorio'),
    body('tax_id').notEmpty().withMessage('El RUT es obligatorio') 
        .isLength({ min: 3, max: 20 }).withMessage('El RUT debe tener entre 3 y 20 caracteres'),
    body('email').optional().isEmail().withMessage('Formato de email inválido'),
    body('phone').optional().isLength({ min: 7, max: 15
    }).withMessage('El teléfono debe tener entre 7 y 15 caracteres'),
    body('position').optional().isLength({ min: 2, max: 50
    }).withMessage('La posición debe tener entre 2 y 50 caracteres'),
    body('department').optional().isLength({ min: 2, max: 50
    }).withMessage('El departamento debe tener entre 2 y 50 caracteres'),
    body('hire_date').optional().isISO8601().withMessage('Fecha de contratación inválida'),
    body('termination_date').optional().isISO8601().withMessage('Fecha de terminación inválida'),
    body('default_cost_center_id').optional().isInt().withMessage('El centro de costo por defecto debe ser un número entero'),
    body('salary_base').optional().isFloat({ min: 0 }).withMessage('El salario base debe ser un número positivo'),
    body('active').optional().isBoolean().withMessage('El estado activo debe ser un booleano')
], createEmpleado);

/**
 * @route   PUT /api/empleados/:id
 * @desc    Actualizar un empleado existente
 * @access  Privado
 * */
router.put('/api/empleados/:id', authenticate, [
    body('full_name').optional().notEmpty().withMessage('El nombre completo es obligatorio'),
    body('tax_id').optional().notEmpty().isLength({ min: 3, max: 20 })
        .withMessage('El RUT debe tener entre 3 y 20 caracteres'),
    body('email').optional().isEmail().withMessage('Formato de email inválido'),
    body('phone').optional().isLength({ min: 7, max: 15 })
        .withMessage('El teléfono debe tener entre 7 y 15 caracteres'),
    body('position').optional().isLength({ min: 2, max: 50 })
        .withMessage('La posición debe tener entre 2 y 50 caracteres'),
    body('department').optional().isLength({ min: 2, max: 50 })
        .withMessage('El departamento debe tener entre 2 y 50 caracteres'),
    body('hire_date').optional().isISO8601().withMessage('Fecha de contratación inválida'),
    body('termination_date').optional().isISO8601().withMessage('Fecha de terminación inválida'),
    body('default_cost_center_id').optional().isInt()
        .withMessage('El centro de costo por defecto debe ser un número entero'),
    body('salary_base').optional().isFloat({ min: 0 })
        .withMessage('El salario base debe ser un número positivo'),
    body('active').optional().isBoolean()
        .withMessage('El estado activo debe ser un booleano')
], updateEmpleado);

/**
 * @route   DELETE /api/empleados/:id
 * @desc    Eliminar un empleado por ID
 * @access  Privado
 * */
router.delete('/api/empleados/:id', authenticate, deleteEmpleado);


export default router;

