import { pool } from '../../config/database.mjs';



async function getAll(filters = {}, pagination = {}) {
    try{
        const limit = pagination.limit || 15; // Default 15 por página
        const offset = parseInt(pagination.offset) || 0;
        const page = pagination.page || Math.floor(offset / limit) + 1;

        console.log('Model pagination params:', { limit, offset, page }); // Debug log

        let query = `
            SELECT 
                employees.id,
                employees.tax_id,
                employees.full_name,
                employees.first_name,
                employees.last_name,
                employees.email,
                employees.phone,
                employees.emergency_phone,
                employees.position,
                employees.department,
                employees.hire_date,
                employees.termination_date,
                employees.default_cost_center_id,
                cost_centers.name AS cost_center_name,
                employees.salary_base,
                employees.active,
                employees.created_at,
                employees.updated_at
            FROM 
                employees LEFT JOIN
                cost_centers ON employees.default_cost_center_id = cost_centers.id
            WHERE
                1 = 1
             `;
        
        let queryParams = [];
        let countQueryParams = [];
        
        // Construir filtros
        if (filters.search && filters.search.trim()) {
            query += ` AND (employees.full_name LIKE ? OR employees.first_name LIKE ? OR employees.last_name LIKE ? OR employees.tax_id LIKE ?) `;
            const searchTerm = `%${filters.search.trim()}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
            countQueryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        if (filters.active !== undefined && filters.active !== '') {
            console.log('Active filter:', filters.active);
            const isActive = filters.active === 'true';
            query += ` AND employees.active = ? `;
            queryParams.push(isActive);
            countQueryParams.push(isActive);
        }
        
        if (filters.department && filters.department.trim()) {
            query += ` AND employees.department LIKE ? `;
            const deptTerm = `%${filters.department.trim()}%`;
            queryParams.push(deptTerm);
            countQueryParams.push(deptTerm);
        }
        
        if (filters.position && filters.position.trim()) {
            query += ` AND employees.position LIKE ? `;
            const posTerm = `%${filters.position.trim()}%`;
            queryParams.push(posTerm);
            countQueryParams.push(posTerm);
        }
        
        if (filters.cost_center) {
            query += ` AND employees.default_cost_center_id = ? `;
            queryParams.push(filters.cost_center);
            countQueryParams.push(filters.cost_center);
        }

        // Query de conteo con los mismos filtros
        let countQuery = `
            SELECT COUNT(*) AS total
            FROM employees LEFT JOIN cost_centers ON employees.default_cost_center_id = cost_centers.id
            WHERE 1 = 1
        `;
        
        // Aplicar los mismos filtros al conteo
        if (filters.search && filters.search.trim()) {
            countQuery += ` AND (employees.full_name LIKE ? OR employees.first_name LIKE ? OR employees.last_name LIKE ? OR employees.tax_id LIKE ?) `;
        }
        if (filters.active !== undefined && filters.active !== '') {
            countQuery += ` AND employees.active = ? `;
        }
        if (filters.department && filters.department.trim()) {
            countQuery += ` AND employees.department LIKE ? `;
        }
        if (filters.position && filters.position.trim()) {
            countQuery += ` AND employees.position LIKE ? `;
        }
        if (filters.cost_center) {
            countQuery += ` AND employees.default_cost_center_id = ? `;
        }

        query += ` ORDER BY employees.full_name ASC `;
        
        console.log('Query:', query);
        console.log('Query params:', queryParams);
        console.log('Count query:', countQuery);
        console.log('Count params:', countQueryParams);
        
        // Obtener el total primero
        const [countResult] = await pool.query(countQuery, countQueryParams);
        const total = parseInt(countResult[0].total, 10) || 0;
        const totalPages = Math.ceil(total / limit);

        console.log('Total records:', total, 'Total pages:', totalPages); // Debug log

        // Agregar paginación a la query principal
        query += ` LIMIT ? OFFSET ?`;
        const finalQueryParams = [...queryParams, limit, offset];
        
        const [rows] = await pool.query(query, finalQueryParams);
        
        console.log('Records fetched:', rows.length); // Debug log

        return {
            items: rows,
            pagination: {
                current_page: page,
                per_page: limit,
                total: total,
                total_pages: totalPages,
                has_next: page < totalPages,
                has_prev: page > 1
            }
        };

    } catch (error) {
        console.error('Error al obtener Empleados:', error);
        throw error;
    }
}


async function getById(id) {
    try {
        const query = `
            SELECT 
                employees.id,
                employees.tax_id,
                employees.full_name,
                employees.first_name,
                employees.last_name,
                employees.email,
                employees.phone,
                employees.emergency_phone,
                employees.position,
                employees.department,
                employees.hire_date,
                employees.termination_date,
                employees.default_cost_center_id,
                cost_centers.name AS cost_center_name,
                employees.salary_base,
                employees.active,
                employees.created_at,
                employees.updated_at
            FROM 
                employees LEFT JOIN
                cost_centers ON employees.default_cost_center_id = cost_centers.id
            WHERE 
                employees.id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        return rows[0];
    } catch (error) {
        console.error('Error al obtener empleado por ID:', error);
        throw error;
    }
}

async function create(employee) {
    try {
        const query = `
            INSERT INTO employees (
                tax_id, full_name, first_name, last_name, email, phone,
                emergency_phone, position, department, hire_date,
                termination_date, default_cost_center_id, salary_base, active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                      ?, ?, ?, ?)
        `;
        const values = [
            employee.tax_id,
            employee.full_name,
            employee.first_name,
            employee.last_name,
            employee.email,
            employee.phone,
            employee.emergency_phone,
            employee.position,
            employee.department,
            employee.hire_date,
            employee.termination_date || null,
            employee.default_cost_center_id || null,
            employee.salary_base || 0,
            employee.active !== undefined ? employee.active : true
        ];
        const [result] = await pool.query(query, values);
        return result.insertId;
    } catch (error) {
        console.error('Error al crear empleado:', error);
        throw error;
    }
}

async function update(id, employee) {
    try {
        const query = `
            UPDATE employees
            SET 
                tax_id = ?,
                full_name = ?,
                first_name = ?,
                last_name = ?,
                email = ?,
                phone = ?,
                emergency_phone = ?,
                position = ?,
                department = ?,
                hire_date = ?,
                termination_date = ?,
                default_cost_center_id = ?,
                salary_base = ?,
                active = ?
            WHERE id = ?
        `;
        const values = [
            employee.tax_id,
            employee.full_name,
            employee.first_name,
            employee.last_name,
            employee.email,
            employee.phone,
            employee.emergency_phone,
            employee.position,
            employee.department,
            employee.hire_date,
            employee.termination_date || null,
            employee.default_cost_center_id || null,
            employee.salary_base || 0,
            employee.active !== undefined ? employee.active : true,
            id
        ];
        const [result] = await pool.query(query, values);
        if (result.affectedRows === 0) {
            return null;
        }
        return {id, ...employee};


    } catch (error) {
        console.error('Error al actualizar empleado:', error);
        throw error;
    }
}
async function remove(id) {
    try {
        const query = `
            DELETE FROM employees
            WHERE id = ?
        `;
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error al eliminar empleado:', error);
        throw error;
    }
}

export const empleadosModel = {
    getAll,
    getById,
    create,
    update,
    remove
};