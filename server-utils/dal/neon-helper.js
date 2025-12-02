import { neon } from '@neondatabase/serverless'


// Neon/PostgreSQL 配置检测
const DATABASE_URL =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.HAIGOO_DATABASE_URL ||
    process.env.haigoo_DATABASE_URL ||
    process.env.pre_haigoo_DATABASE_URL ||
    process.env.PRE_HAIGOO_DATABASE_URL ||
    null
const DATABASE_CONFIGURED = !!DATABASE_URL

// 创建 Neon SQL 客户端
const createNeonClient = () => {
    if (!DATABASE_CONFIGURED) return null
    return neon(DATABASE_URL)
}

/**
 * Neon/PostgreSQL 帮助类，提供 serverless 模式的数据库操作方法
 */
const neonHelper = {
    // 配置信息
    isConfigured: DATABASE_CONFIGURED,

    /**
     * 创建并返回 Neon SQL 客户端
     * @returns {Function|null} Neon SQL 客户端函数
     */
    getClient() {
        return createNeonClient()
    },

    /**
     * 执行 SQL 查询（serverless 模式）
     * @param {string} query - SQL 查询语句
     * @param {Array} params - 查询参数数组
     * @returns {Promise<Object|null>} 查询结果，失败返回 null
     */
    async query(query, params = []) {
        if (!DATABASE_CONFIGURED) return null

        const sql = createNeonClient()
        if (!sql) return null

        try {
            return await sql.query(query, params)
        } catch (error) {
            console.error('[Neon/PostgreSQL] Query error:', error.message)
            console.error('[Neon/PostgreSQL] Query:', query)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return null
        }
    },

    /**
     * 执行事务（serverless 模式）
     * @param {Function} callback - 事务回调函数，接收 sql 客户端作为参数
     * @returns {Promise<any>} 事务执行结果
     */
    async transaction(callback) {
        if (!DATABASE_CONFIGURED) throw new Error('Database not configured')

        const originalSql = createNeonClient()
        if (!originalSql) throw new Error('Failed to create database client')

        // 创建兼容层函数，确保在事务回调中使用的sql()方法实际上调用query()方法
        function sql(query, params) {
            return originalSql.query(query, params)
        }

        // 添加query方法以保持一致性
        sql.query = (query, params) => originalSql.query(query, params)

        try {
            // 开始事务
            await originalSql.query('BEGIN')

            // 执行事务回调
            const result = await callback(sql)

            // 提交事务
            await originalSql.query('COMMIT')
            return result
        } catch (error) {
            // 回滚事务
            await originalSql.query('ROLLBACK')
            console.error('[Neon/PostgreSQL] Transaction error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            throw error
        }
    },

    /**
     * 插入数据（serverless 模式）
     * @param {string} table - 表名
     * @param {Object} data - 要插入的数据对象
     * @returns {Promise<Object|null>} 插入结果，失败返回 null
     */
    async insert(table, data) {
        if (!DATABASE_CONFIGURED) return null

        try {
            const columns = Object.keys(data)
            const values = Object.values(data)
            const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')

            const query = `
                INSERT INTO ${table} (${columns.join(', ')})
                VALUES (${placeholders})
                RETURNING *
            `

            const sql = createNeonClient()
            return await sql.query(query, values)
        } catch (error) {
            console.error('[Neon/PostgreSQL] Insert error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return null
        }
    },

    /**
     * 查询数据（serverless 模式）
     * @param {string} table - 表名
     * @param {Object} conditions - 查询条件
     * @param {Object} options - 选项（limit, offset, orderBy 等）
     * @returns {Promise<Object|null>} 查询结果，失败返回 null
     */
    async select(table, conditions = {}, options = {}) {
        if (!DATABASE_CONFIGURED) return null

        try {
            let query = `SELECT * FROM ${table}`
            const params = []

            // 添加条件
            if (Object.keys(conditions).length > 0) {
                query += ' WHERE '
                const whereClauses = Object.keys(conditions).map((column, index) => {
                    params.push(conditions[column])
                    return `${column} = $${index + 1}`
                })
                query += whereClauses.join(' AND ')
            }

            // 添加排序
            if (options.orderBy) {
                query += ` ORDER BY ${options.orderBy}`
                if (options.orderDirection) {
                    query += ` ${options.orderDirection}`
                }
            }

            // 添加分页
            if (options.limit !== undefined) {
                query += ` LIMIT ${options.limit}`
            }
            if (options.offset !== undefined) {
                query += ` OFFSET ${options.offset}`
            }
            const sql = createNeonClient()
            return await sql.query(query, params)
        } catch (error) {
            console.error('[Neon/PostgreSQL] Select error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return null
        }
    },

    /**
     * 更新数据（serverless 模式）
     * @param {string} table - 表名
     * @param {Object} data - 要更新的数据
     * @param {Object} conditions - 更新条件
     * @returns {Promise<Object|null>} 更新结果，失败返回 null
     */
    async update(table, data, conditions) {
        if (!DATABASE_CONFIGURED) return null

        try {
            const setColumns = Object.keys(data)
            const conditionColumns = Object.keys(conditions)

            if (setColumns.length === 0 || conditionColumns.length === 0) {
                throw new Error('Update data and conditions cannot be empty')
            }

            const params = []
            const setClauses = setColumns.map((column, index) => {
                params.push(data[column])
                return `${column} = $${index + 1}`
            })

            const whereClauses = conditionColumns.map((column, index) => {
                params.push(conditions[column])
                return `${column} = $${setColumns.length + index + 1}`
            })

            const query = `
                UPDATE ${table}
                SET ${setClauses.join(', ')}
                WHERE ${whereClauses.join(' AND ')}
                RETURNING *
            `

            const sql = createNeonClient()
            return await sql.query(query, params)
        } catch (error) {
            console.error('[Neon/PostgreSQL] Update error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return null
        }
    },

    /**
     * 删除数据（serverless 模式）
     * @param {string} table - 表名
     * @param {Object} conditions - 删除条件
     * @returns {Promise<Object|null>} 删除结果，失败返回 null
     */
    async delete(table, conditions) {
        if (!DATABASE_CONFIGURED) return null

        try {
            if (Object.keys(conditions).length === 0) {
                throw new Error('Delete conditions cannot be empty')
            }

            const params = []
            const whereClauses = Object.keys(conditions).map((column, index) => {
                params.push(conditions[column])
                return `${column} = $${index + 1}`
            })

            const query = `
                DELETE FROM ${table}
                WHERE ${whereClauses.join(' AND ')}
                RETURNING *
            `

            const sql = createNeonClient()
            return await sql.query(query, params)
        } catch (error) {
            console.error('[Neon/PostgreSQL] Delete error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return null
        }
    },

    /**
     * 创建表（serverless 模式）
     * @param {string} table - 表名
     * @param {Object} schema - 表结构定义
     * @returns {Promise<boolean>} 是否创建成功
     */
    async createTable(table, schema) {
        if (!DATABASE_CONFIGURED) return false

        try {
            const columns = Object.entries(schema).map(([name, type]) => {
                return `${name} ${type}`
            }).join(', ')

            const query = `CREATE TABLE IF NOT EXISTS ${table} (${columns})`
            const sql = createNeonClient()
            await sql.query(query)
            return true
        } catch (error) {
            console.error('[Neon/PostgreSQL] Create table error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return false
        }
    },

    /**
     * 删除表（serverless 模式）
     * @param {string} table - 表名
     * @returns {Promise<boolean>} 是否删除成功
     */
    async dropTable(table) {
        if (!DATABASE_CONFIGURED) return false

        try {
            const query = `DROP TABLE IF EXISTS ${table}`
            const sql = createNeonClient()
            await sql.query(query)
            return true
        } catch (error) {
            console.error('[Neon/PostgreSQL] Drop table error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return false
        }
    },

    /**
     * 检查表是否存在（serverless 模式）
     * @param {string} table - 表名
     * @returns {Promise<boolean|null>} 表是否存在，失败返回 null
     */
    async tableExists(table) {
        if (!DATABASE_CONFIGURED) return null

        try {
            const query = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )
            `
            const sql = createNeonClient()
            const result = await sql.query(query, [table])
            return result?.[0].exists ?? false
        } catch (error) {
            console.error('[Neon/PostgreSQL] Table exists check error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return null
        }
    },

    /**
     * 获取表的所有记录数（serverless 模式）
     * @param {string} table - 表名
     * @param {Object} conditions - 可选的查询条件
     * @returns {Promise<number|null>} 记录数，失败返回 null
     */
    async count(table, conditions = {}) {
        if (!DATABASE_CONFIGURED) return null

        try {
            let query = `SELECT COUNT(*) FROM ${table}`
            const params = []

            if (Object.keys(conditions).length > 0) {
                query += ' WHERE '
                const whereClauses = Object.keys(conditions).map((column, index) => {
                    params.push(conditions[column])
                    return `${column} = $${index + 1}`
                })
                query += whereClauses.join(' AND ')
            }

            const sql = createNeonClient()
            const result = await sql.query(query, params)
            return parseInt(result?.[0].count, 10)
        } catch (error) {
            console.error('[Neon/PostgreSQL] Count error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return null
        }
    },

    /**
     * 执行批处理查询（serverless 模式）
     * @param {Array<{query: string, params: Array}>} queries - 查询对象数组
     * @returns {Promise<Array<Object|null>>} 查询结果数组
     */
    async batch(queries) {
        if (!DATABASE_CONFIGURED) return queries.map(() => null)

        try {
            const sql = createNeonClient()
            const results = []

            for (const { query, params = [] } of queries) {
                const result = await sql.query(query, params)
                results.push(result)
            }

            return results
        } catch (error) {
            console.error('[Neon/PostgreSQL] Batch query error:', error.message)
            console.error('[Neon/PostgreSQL] Error stack:', error.stack)
            return queries.map(() => null)
        }
    }
}

// 导出统一的 neonHelper 对象
export default neonHelper
