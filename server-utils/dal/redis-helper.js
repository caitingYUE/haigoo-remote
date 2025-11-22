// 导入Redis客户端
const { createClient } = require('redis')

// Redis配置检测
const REDIS_URL =
    process.env.REDIS_URL ||
    process.env.haigoo_REDIS_URL ||
    process.env.HAIGOO_REDIS_URL ||
    process.env.UPSTASH_REDIS_URL ||
    process.env.pre_haigoo_REDIS_URL ||
    process.env.PRE_HAIGOO_REDIS_URL ||
    null
const REDIS_CONFIGURED = !!REDIS_URL

// Redis客户端缓存
let __redisClient = globalThis.__haigoo_redis_client || null

/**
 * 获取或创建 Redis 客户端
 * @private
 */
async function getRedisClient() {
    if (!REDIS_CONFIGURED) return null
    if (__redisClient) return __redisClient

    try {
        const client = createClient({ url: REDIS_URL })
        client.on('error', err => console.error('[Redis] Redis error:', err))
        await client.connect()
        __redisClient = client
        globalThis.__haigoo_redis_client = client
        console.log('[Redis] Redis connected')
        return client
    } catch (error) {
        console.error('[Redis] Failed to connect to Redis:', error.message)
        return null
    }
}

/**
 * Redis 帮助类，提供KV、List、Set、Hash类型的操作
 */
const redisHelper = {
    // 配置信息
    isConfigured: REDIS_CONFIGURED,
    
    /**
     * 获取原始Redis客户端
     * @returns {Promise<Object|null>} Redis客户端实例
     */
    async getClient() {
        return await getRedisClient()
    },
    
    // ===== KV 类型操作 =====
    
    /**
     * 设置键值对
     * @param {string} key - 键
     * @param {string|number} value - 值
     * @param {Object} options - 选项，包含过期时间等
     * @returns {Promise<boolean>} 是否设置成功
     */
    async set(key, value, options = {}) {
        const client = await getRedisClient()
        if (!client) return false
        
        try {
            await client.set(key, value, options)
            return true
        } catch (error) {
            console.error('[Redis] set error:', error.message)
            return false
        }
    },
    
    /**
     * 获取值
     * @param {string} key - 键
     * @returns {Promise<string|null>} 值，不存在返回null
     */
    async get(key) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.get(key)
        } catch (error) {
            console.error('[Redis] get error:', error.message)
            return null
        }
    },
    
    /**
     * 删除键
     * @param {string} key - 键
     * @returns {Promise<boolean>} 是否删除成功
     */
    async del(key) {
        const client = await getRedisClient()
        if (!client) return false
        
        try {
            await client.del(key)
            return true
        } catch (error) {
            console.error('[Redis] del error:', error.message)
            return false
        }
    },
    
    /**
     * 检查键是否存在
     * @param {string} key - 键
     * @returns {Promise<boolean>} 键是否存在
     */
    async exists(key) {
        const client = await getRedisClient()
        if (!client) return false
        
        try {
            return await client.exists(key) > 0
        } catch (error) {
            console.error('[Redis] exists error:', error.message)
            return false
        }
    },
    
    /**
     * 设置键的过期时间
     * @param {string} key - 键
     * @param {number} seconds - 过期时间（秒）
     * @returns {Promise<boolean>} 是否设置成功
     */
    async expire(key, seconds) {
        const client = await getRedisClient()
        if (!client) return false
        
        try {
            return await client.expire(key, seconds) > 0
        } catch (error) {
            console.error('[Redis] expire error:', error.message)
            return false
        }
    },
    
    // ===== List 类型操作 =====
    
    /**
     * 从列表左侧推入元素
     * @param {string} key - 键
     * @param {string|number} value - 值
     * @returns {Promise<number|null>} 操作后的列表长度，失败返回null
     */
    async lpush(key, value) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.lPush(key, value)
        } catch (error) {
            console.error('[Redis] lpush error:', error.message)
            return null
        }
    },
    
    /**
     * 从列表右侧推入元素
     * @param {string} key - 键
     * @param {string|number} value - 值
     * @returns {Promise<number|null>} 操作后的列表长度，失败返回null
     */
    async rpush(key, value) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.rPush(key, value)
        } catch (error) {
            console.error('[Redis] rpush error:', error.message)
            return null
        }
    },
    
    /**
     * 从列表左侧弹出元素
     * @param {string} key - 键
     * @returns {Promise<string|null>} 弹出的元素，空列表或失败返回null
     */
    async lpop(key) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.lPop(key)
        } catch (error) {
            console.error('[Redis] lpop error:', error.message)
            return null
        }
    },
    
    /**
     * 从列表右侧弹出元素
     * @param {string} key - 键
     * @returns {Promise<string|null>} 弹出的元素，空列表或失败返回null
     */
    async rpop(key) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.rPop(key)
        } catch (error) {
            console.error('[Redis] rpop error:', error.message)
            return null
        }
    },
    
    /**
     * 获取列表长度
     * @param {string} key - 键
     * @returns {Promise<number|null>} 列表长度，失败返回null
     */
    async llen(key) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.lLen(key)
        } catch (error) {
            console.error('[Redis] llen error:', error.message)
            return null
        }
    },
    
    /**
     * 获取列表指定范围的元素
     * @param {string} key - 键
     * @param {number} start - 起始索引
     * @param {number} stop - 结束索引
     * @returns {Promise<Array<string>|null>} 元素数组，失败返回null
     */
    async lrange(key, start, stop) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.lRange(key, start, stop)
        } catch (error) {
            console.error('[Redis] lrange error:', error.message)
            return null
        }
    },
    
    // ===== Set 类型操作 =====
    
    /**
     * 向集合添加一个或多个成员
     * @param {string} key - 键
     * @param {Array<string|number>} members - 成员数组
     * @returns {Promise<number|null>} 添加的成员数量，失败返回null
     */
    async sadd(key, ...members) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.sAdd(key, members)
        } catch (error) {
            console.error('[Redis] sadd error:', error.message)
            return null
        }
    },
    
    /**
     * 从集合移除一个或多个成员
     * @param {string} key - 键
     * @param {Array<string|number>} members - 成员数组
     * @returns {Promise<number|null>} 移除的成员数量，失败返回null
     */
    async srem(key, ...members) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.sRem(key, members)
        } catch (error) {
            console.error('[Redis] srem error:', error.message)
            return null
        }
    },
    
    /**
     * 判断成员是否在集合中
     * @param {string} key - 键
     * @param {string|number} member - 成员
     * @returns {Promise<boolean|null>} 是否在集合中，失败返回null
     */
    async sismember(key, member) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.sIsMember(key, member) > 0
        } catch (error) {
            console.error('[Redis] sismember error:', error.message)
            return null
        }
    },
    
    /**
     * 获取集合的所有成员
     * @param {string} key - 键
     * @returns {Promise<Array<string>|null>} 成员数组，失败返回null
     */
    async smembers(key) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.sMembers(key)
        } catch (error) {
            console.error('[Redis] smembers error:', error.message)
            return null
        }
    },
    
    /**
     * 获取集合成员数量
     * @param {string} key - 键
     * @returns {Promise<number|null>} 成员数量，失败返回null
     */
    async scard(key) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.sCard(key)
        } catch (error) {
            console.error('[Redis] scard error:', error.message)
            return null
        }
    },
    
    // ===== Hash 类型操作 =====
    
    /**
     * 设置哈希表字段值
     * @param {string} key - 键
     * @param {string} field - 字段名
     * @param {string|number} value - 值
     * @returns {Promise<boolean>} 是否设置成功
     */
    async hset(key, field, value) {
        const client = await getRedisClient()
        if (!client) return false
        
        try {
            await client.hSet(key, field, value)
            return true
        } catch (error) {
            console.error('[Redis] hset error:', error.message)
            return false
        }
    },
    
    /**
     * 批量设置哈希表字段值
     * @param {string} key - 键
     * @param {Object} fieldValuePairs - 字段值对对象
     * @returns {Promise<boolean>} 是否设置成功
     */
    async hsetMultiple(key, fieldValuePairs) {
        const client = await getRedisClient()
        if (!client) return false
        
        try {
            await client.hSet(key, fieldValuePairs)
            return true
        } catch (error) {
            console.error('[Redis] hsetMultiple error:', error.message)
            return false
        }
    },
    
    /**
     * 获取哈希表字段值
     * @param {string} key - 键
     * @param {string} field - 字段名
     * @returns {Promise<string|null>} 字段值，不存在或失败返回null
     */
    async hget(key, field) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.hGet(key, field)
        } catch (error) {
            console.error('[Redis] hget error:', error.message)
            return null
        }
    },
    
    /**
     * 获取哈希表所有字段和值
     * @param {string} key - 键
     * @returns {Promise<Object|null>} 字段值对对象，失败返回null
     */
    async hgetall(key) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.hGetAll(key)
        } catch (error) {
            console.error('[Redis] hgetall error:', error.message)
            return null
        }
    },
    
    /**
     * 删除哈希表字段
     * @param {string} key - 键
     * @param {string|Array<string>} fields - 字段名或字段名数组
     * @returns {Promise<boolean>} 是否删除成功
     */
    async hdel(key, fields) {
        const client = await getRedisClient()
        if (!client) return false
        
        try {
            await client.hDel(key, fields)
            return true
        } catch (error) {
            console.error('[Redis] hdel error:', error.message)
            return false
        }
    },
    
    /**
     * 检查哈希表字段是否存在
     * @param {string} key - 键
     * @param {string} field - 字段名
     * @returns {Promise<boolean|null>} 字段是否存在，失败返回null
     */
    async hexists(key, field) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.hExists(key, field)
        } catch (error) {
            console.error('[Redis] hexists error:', error.message)
            return null
        }
    },
    
    /**
     * 获取哈希表字段数量
     * @param {string} key - 键
     * @returns {Promise<number|null>} 字段数量，失败返回null
     */
    async hlen(key) {
        const client = await getRedisClient()
        if (!client) return null
        
        try {
            return await client.hLen(key)
        } catch (error) {
            console.error('[Redis] hlen error:', error.message)
            return null
        }
    }
}

// 导出统一的redisHelper对象
module.exports = redisHelper