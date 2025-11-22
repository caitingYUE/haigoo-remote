import { MongoClient, MongoClientOptions, ObjectId } from 'mongodb';
import { attachDatabasePool } from '@vercel/functions';

// MongoDB配置检测
const MONGODB_URI =
    process.env.MONGODB_URI ||
    process.env.haigoo_MONGODB_URI ||
    process.env.HAIGOO_MONGODB_URI ||
    process.env.UPSTASH_MONGODB_URI ||
    process.env.pre_haigoo_MONGODB_URI ||
    process.env.PRE_HAIGOO_MONGODB_URI ||
    null
const MONGODB_CONFIGURED = !!MONGODB_URI

// 数据库名称配置
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'haigoo_remote'

// 客户端配置选项
const options = {
    appName: "devrel.vercel.integration",
    maxIdleTimeMS: 5000,
    retryWrites: true,
    retryReads: true
};

// 创建MongoDB客户端实例
let __mongoClient = null;
let __dbInstance = null;

/**
 * 初始化并获取MongoDB客户端
 * @private
 */
async function getMongoClient() {
    if (!MONGODB_CONFIGURED) {
        console.warn('[MongoDB] MongoDB not configured');
        return null;
    }
    
    if (__mongoClient) return __mongoClient;

    try {
        const client = new MongoClient(MONGODB_URI, options);
        
        // 连接到MongoDB
        await client.connect();
        console.log('[MongoDB] Connected successfully');
        
        // 保存客户端实例
        __mongoClient = client;
        
        // Attach the client to ensure proper cleanup on function suspension
        attachDatabasePool(client);
        
        return client;
    } catch (error) {
        console.error('[MongoDB] Failed to connect:', error.message);
        return null;
    }
}

/**
 * 获取数据库实例
 * @private
 */
async function getDatabase() {
    if (!MONGODB_CONFIGURED) return null;
    if (__dbInstance) return __dbInstance;
    
    const client = await getMongoClient();
    if (!client) return null;
    
    try {
        __dbInstance = client.db(MONGODB_DB_NAME);
        return __dbInstance;
    } catch (error) {
        console.error('[MongoDB] Failed to get database:', error.message);
        return null;
    }
}

/**
 * MongoDB 帮助类，提供常用的MongoDB操作功能
 */
const mongodbHelper = {
    // 配置信息
    isConfigured: MONGODB_CONFIGURED,
    
    /**
     * 获取原始MongoDB客户端
     * @returns {Promise<MongoClient|null>} MongoDB客户端实例
     */
    async getClient() {
        return await getMongoClient();
    },
    
    /**
     * 获取数据库实例
     * @param {string} [dbName] - 可选的数据库名称
     * @returns {Promise<Db|null>} 数据库实例
     */
    async getDb(dbName = MONGODB_DB_NAME) {
        if (!MONGODB_CONFIGURED) return null;
        
        const client = await getMongoClient();
        if (!client) return null;
        
        try {
            return client.db(dbName);
        } catch (error) {
            console.error('[MongoDB] Failed to get database:', error.message);
            return null;
        }
    },
    
    /**
     * 获取集合实例
     * @param {string} collectionName - 集合名称
     * @param {string} [dbName] - 可选的数据库名称
     * @returns {Promise<Collection|null>} 集合实例
     */
    async getCollection(collectionName, dbName = MONGODB_DB_NAME) {
        const db = await this.getDb(dbName);
        if (!db) return null;
        
        try {
            return db.collection(collectionName);
        } catch (error) {
            console.error(`[MongoDB] Failed to get collection ${collectionName}:`, error.message);
            return null;
        }
    },
    
    // ===== CRUD 操作 =====
    
    /**
     * 插入单个文档
     * @param {string} collectionName - 集合名称
     * @param {Object} document - 要插入的文档
     * @param {Object} [options] - 插入选项
     * @returns {Promise<Object|null>} 插入结果，包含插入的ID
     */
    async insertOne(collectionName, document, options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            return await collection.insertOne(document, options);
        } catch (error) {
            console.error(`[MongoDB] Failed to insertOne into ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 插入多个文档
     * @param {string} collectionName - 集合名称
     * @param {Array<Object>} documents - 要插入的文档数组
     * @param {Object} [options] - 插入选项
     * @returns {Promise<Object|null>} 插入结果，包含插入的ID数组
     */
    async insertMany(collectionName, documents, options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            return await collection.insertMany(documents, options);
        } catch (error) {
            console.error(`[MongoDB] Failed to insertMany into ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 查询单个文档
     * @param {string} collectionName - 集合名称
     * @param {Object} filter - 查询条件
     * @param {Object} [options] - 查询选项
     * @returns {Promise<Object|null>} 查询到的文档
     */
    async findOne(collectionName, filter = {}, options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            return await collection.findOne(filter, options);
        } catch (error) {
            console.error(`[MongoDB] Failed to findOne in ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 查询多个文档
     * @param {string} collectionName - 集合名称
     * @param {Object} filter - 查询条件
     * @param {Object} [options] - 查询选项（包含投影、排序、限制等）
     * @returns {Promise<Array<Object>|null>} 查询到的文档数组
     */
    async find(collectionName, filter = {}, options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            const cursor = collection.find(filter, options);
            return await cursor.toArray();
        } catch (error) {
            console.error(`[MongoDB] Failed to find in ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 更新单个文档
     * @param {string} collectionName - 集合名称
     * @param {Object} filter - 查询条件
     * @param {Object} update - 更新操作符
     * @param {Object} [options] - 更新选项
     * @returns {Promise<Object|null>} 更新结果
     */
    async updateOne(collectionName, filter = {}, update = {}, options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            return await collection.updateOne(filter, update, options);
        } catch (error) {
            console.error(`[MongoDB] Failed to updateOne in ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 更新多个文档
     * @param {string} collectionName - 集合名称
     * @param {Object} filter - 查询条件
     * @param {Object} update - 更新操作符
     * @param {Object} [options] - 更新选项
     * @returns {Promise<Object|null>} 更新结果
     */
    async updateMany(collectionName, filter = {}, update = {}, options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            return await collection.updateMany(filter, update, options);
        } catch (error) {
            console.error(`[MongoDB] Failed to updateMany in ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 删除单个文档
     * @param {string} collectionName - 集合名称
     * @param {Object} filter - 查询条件
     * @param {Object} [options] - 删除选项
     * @returns {Promise<Object|null>} 删除结果
     */
    async deleteOne(collectionName, filter = {}, options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            return await collection.deleteOne(filter, options);
        } catch (error) {
            console.error(`[MongoDB] Failed to deleteOne from ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 删除多个文档
     * @param {string} collectionName - 集合名称
     * @param {Object} filter - 查询条件
     * @param {Object} [options] - 删除选项
     * @returns {Promise<Object|null>} 删除结果
     */
    async deleteMany(collectionName, filter = {}, options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            return await collection.deleteMany(filter, options);
        } catch (error) {
            console.error(`[MongoDB] Failed to deleteMany from ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 计算文档数量
     * @param {string} collectionName - 集合名称
     * @param {Object} filter - 查询条件
     * @returns {Promise<number|null>} 文档数量
     */
    async countDocuments(collectionName, filter = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            return await collection.countDocuments(filter);
        } catch (error) {
            console.error(`[MongoDB] Failed to countDocuments in ${collectionName}:`, error.message);
            return null;
        }
    },
    
    /**
     * 执行聚合操作
     * @param {string} collectionName - 集合名称
     * @param {Array<Object>} pipeline - 聚合管道
     * @param {Object} [options] - 聚合选项
     * @returns {Promise<Array<Object>|null>} 聚合结果
     */
    async aggregate(collectionName, pipeline = [], options = {}) {
        const collection = await this.getCollection(collectionName);
        if (!collection) return null;
        
        try {
            const cursor = collection.aggregate(pipeline, options);
            return await cursor.toArray();
        } catch (error) {
            console.error(`[MongoDB] Failed to aggregate in ${collectionName}:`, error.message);
            return null;
        }
    },
    
    // ===== 工具方法 =====
    
    /**
     * 创建ObjectId实例
     * @param {string} [idString] - 可选的ID字符串
     * @returns {ObjectId} ObjectId实例
     */
    ObjectId(idString) {
        return idString ? new ObjectId(idString) : new ObjectId();
    },
    
    /**
     * 检查字符串是否为有效的ObjectId
     * @param {string} idString - ID字符串
     * @returns {boolean} 是否为有效ObjectId
     */
    isValidObjectId(idString) {
        return ObjectId.isValid(idString);
    },
    
    /**
     * 创建带ObjectId的查询条件
     * @param {string} idField - ID字段名
     * @param {string} idValue - ID值
     * @returns {Object} 查询条件对象
     */
    idFilter(idField, idValue) {
        if (!this.isValidObjectId(idValue)) return { [idField]: idValue };
        return { [idField]: new ObjectId(idValue) };
    }
};

// 导出统一的mongodbHelper对象
export default mongodbHelper;