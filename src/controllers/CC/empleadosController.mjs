import { empleadosModel } from '../../models/CC/empleadosModel.mjs';


async function getEmpleados(req, res, next) {
    try {
        console.log('Query params received:', req.query); // Debug log

        const filters = {
            search: req.query.search,
            active: req.query.active,
            department: req.query.department,
            position: req.query.position,
            cost_center: req.query.cost_center
        };

        // Manejar paginación correctamente
        const page = parseInt(req.query.page) || 1;
        const per_page = parseInt(req.query.per_page) || 15;
        const limit = per_page;
        const offset = (page - 1) * per_page;

        const pagination = {
            limit: limit,
            offset: offset,
            page: page,
            per_page: per_page
        };

        console.log('Pagination config:', pagination); // Debug log

        // Limpiar filtros vacíos
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined || filters[key] === null || filters[key] === '') {
                delete filters[key];
            }
        });

        console.log('Filters applied:', filters); // Debug log

        const result = await empleadosModel.getAll(filters, pagination);

        res.json({
            success: true,
            data: result,
            message: 'Empleados obtenidos exitosamente'
        });

        
    } catch (error) {
        console.error('Error al obtener empleados:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al obtener empleados',
            error: 'Error interno del servidor' 
        });
    }
}

async function getEmpleadoById(req, res, next) {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ error: 'ID de empleado es requerido' });
        }

        const empleado = await empleadosModel.getById(id);
        if (!empleado) {
            return res.status(404).json({ error: 'Empleado no encontrado' });
        }

        res.json({
            success: true,
            data: empleado
        });

    } catch (error) {
        console.error('Error al obtener empleado por ID:', error);
        res.status(500).json({ error: 'Error al obtener empleado por ID' });
    }
}

async function createEmpleado(req, res, next) {
    try {
        const empleadoData = req.body;
        console.log('Received employee data:', empleadoData); // Debug log
        
        if (!empleadoData || !empleadoData.full_name || !empleadoData.tax_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Datos de empleado incompletos. Se requieren full_name y tax_id',
                error: 'Datos de empleado incompletos' 
            });
        }

        const newEmpleado = await empleadosModel.create(empleadoData);
        res.status(201).json({
            success: true,
            data: { id: newEmpleado },
            message: 'Empleado creado exitosamente'
        });

    } catch (error) {
        console.error('Error al crear empleado:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error interno del servidor al crear empleado',
            error: 'Error al crear empleado' 
        });
    }
}

async function updateEmpleado(req, res, next) {
    try {
        const id = req.params.id;
        const empleadoData = req.body;

        if (!id || !empleadoData) {
            return res.status(400).json({ error: 'ID de empleado y datos son requeridos' });
        }

        const updatedEmpleado = await empleadosModel.update(id, empleadoData);
        if (!updatedEmpleado) {
            return res.status(404).json({ error: 'Empleado no encontrado' });
        }

        res.json({
            success: true,
            data: updatedEmpleado
        });

    } catch (error) {
        console.error('Error al actualizar empleado:', error);
        res.status(500).json({ error: 'Error al actualizar empleado' });
    }
}

async function deleteEmpleado(req, res, next) {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ error: 'ID de empleado es requerido' });
        }

        const result = await empleadosModel.remove(id);
        if (!result) {
            return res.status(404).json({ error: 'Empleado no encontrado' });
        }

        res.json({
            success: true,
            message: 'Empleado eliminado correctamente'
        });

    } catch (error) {
        console.error('Error al eliminar empleado:', error);
        res.status(500).json({ error: 'Error al eliminar empleado' });
    }
}


export {
    getEmpleados,
    getEmpleadoById,
    createEmpleado,
    updateEmpleado,
    deleteEmpleado
}