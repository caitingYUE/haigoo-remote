import fs from 'fs';
import lark from '@larksuiteoapi/node-sdk';

// 飞书配置 - 从环境变量获取
const LARK_APP_ID = process.env.LARK_APP_ID || '';
const LARK_APP_SECRET = process.env.LARK_APP_SECRET || '';
const DEBUG_CHAT_ID = process.env.DEBUG_CHAT_ID || '';

// 创建飞书客户端
const client = new lark.Client({
    appId: LARK_APP_ID,
    appSecret: LARK_APP_SECRET,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
});

/**
 * 发送用户文本消息
 * @param {string} openId - 用户open_id
 * @param {string} content - 消息内容
 * @param {string} userId - 用户user_id（可选）
 */
export async function sendUserMessage(openId, content, userId = '') {
    try {
        // 构造请求参数
        const receiveIdType = userId ? 'user_id' : 'open_id';
        const receiveId = userId || openId;

        const request = {
            receive_id_type: receiveIdType,
            receive_id: receiveId,
            content: JSON.stringify({ text: content }),
            msg_type: 'text',
        };

        // 发起请求
        const response = await client.im.message.create(request);

        // 处理失败返回
        if (response.code !== 0) {
            console.error(`client.im.message.create failed, code: ${response.code}, msg: ${response.msg}, resp: ${JSON.stringify(response, null, 4)}`);
            return;
        }

        // 处理业务结果
        return response.data;

    } catch (error) {
        console.error('发送用户消息失败', error);
    }
}

/**
 * 发送用户卡片消息
 * @param {string} openId - 用户open_id
 * @param {string} content - 消息内容
 * @param {string} color - 卡片颜色（默认green）
 * @param {string} extraContent - 额外内容（可选）
 * @param {string} userId - 用户user_id（可选）
 */
export async function sendUserCard(openId, content, color = 'green', extraContent = '', userId = '') {
    try {
        // 构造卡片元素
        const cardFooterElements = [
            { tag: 'hr' },
            {
                elements: [
                    {
                        content: '@海狗',
                        tag: 'lark_md',
                    }
                ],
                tag: 'note',
            },
        ];

        const cardElements = [
            {
                tag: 'div',
                text: {
                    content: content,
                    tag: 'lark_md',
                },
            },
        ];

        if (extraContent) {
            cardElements.push({
                tag: 'collapsible_panel',
                header: {
                    title: { tag: 'markdown', content: '**展开更多**' },
                },
                elements: [
                    {
                        tag: 'div',
                        text: {
                            content: extraContent,
                            tag: 'lark_md',
                        },
                    }
                ],
            });
        }

        cardElements.push(...cardFooterElements);

        const card = {
            config: { wide_screen_mode: true },
            header: {
                template: color,
                title: {
                    content: `岗位推荐 ${new Date().toLocaleString('zh-CN')}`,
                    tag: 'plain_text',
                },
            },
            elements: cardElements,
        };

        // 构造请求参数
        const receiveIdType = userId ? 'user_id' : 'open_id';
        const receiveId = userId || openId;

        const request = {
            receive_id_type: receiveIdType,
            receive_id: receiveId,
            content: JSON.stringify(card),
            msg_type: 'interactive',
        };

        // 发起请求
        const response = await client.im.message.create(request);

        // 处理失败返回
        if (response.code !== 0) {
            console.error(`client.im.message.create failed, code: ${response.code}, msg: ${response.msg}, resp: ${JSON.stringify(response, null, 4)}`);
            return;
        }

        // 处理业务结果
        return response.data;

    } catch (error) {
        console.error('发送用户卡片消息失败', error);
    }
}

/**
 * 发送群聊文本消息
 * @param {string} chatId - 群聊ID
 * @param {string} openId - 用户open_id（用于@用户）
 * @param {string} content - 消息内容
 */
export async function sendChatMessage(chatId, openId, content) {
    try {
        // 构造请求参数
        const request = {
            receive_id_type: 'chat_id',
            receive_id: chatId,
            content: JSON.stringify({
                text: `<at user_id="${openId}"></at> ${content}`
            }),
            msg_type: 'text',
        };

        // 发起请求
        const response = await client.im.message.create(request);

        // 处理失败返回
        if (response.code !== 0) {
            console.error(`client.im.message.create failed, code: ${response.code}, msg: ${response.msg}, resp: ${JSON.stringify(response, null, 4)}`);
            return;
        }

        // 处理业务结果
        return response.data;

    } catch (error) {
        console.error('发送群聊消息失败', error);
        throw error;
    }
}

/**
 * 发送群聊卡片消息
 * @param {string} chatId - 群聊ID
 * @param {string} content - 消息内容
 * @param {string} color - 卡片颜色（默认green）
 * @param {string} title - 卡片标题（默认岗位推荐）
 */
export async function sendChatCard(chatId, content, color = 'green', title = '岗位推荐') {
    try {
        // 构造卡片元素
        const cardFooterElements = [
            { tag: 'hr' },
            {
                elements: [
                    {
                        content: '@海狗 —— Web Application',
                        tag: 'lark_md',
                    }
                ],
                tag: 'note',
            },
        ];

        const cardElements = [
            {
                tag: 'div',
                text: {
                    content: content,
                    tag: 'lark_md',
                },
            },
        ];

        cardElements.push(...cardFooterElements);

        const card = {
            config: { wide_screen_mode: true },
            header: {
                template: color,
                title: {
                    content: `${title} ${new Date().toLocaleString('zh-CN')}`,
                    tag: 'plain_text',
                },
            },
            elements: cardElements,
        };

        // 构造请求参数
        const request = {
            receive_id_type: 'chat_id',
            receive_id: chatId,
            content: JSON.stringify(card),
            msg_type: 'interactive',
        };

        // 发起请求
        const response = await client.im.message.create(request);

        // 处理失败返回
        if (response.code !== 0) {
            console.error(`client.im.message.create failed, code: ${response.code}, msg: ${response.msg}, resp: ${JSON.stringify(response, null, 4)}`);
            return;
        }

        // 处理业务结果
        return response.data;

    } catch (error) {
        console.error('发送群聊卡片消息失败', error);
    }
}

/**
 * 回复群聊文本消息
 * @param {string} senderId - 发送者ID
 * @param {string} messageId - 消息ID
 * @param {string} content - 回复内容
 * @param {boolean} replyInThread - 是否在话题中回复（默认false）
 */
export async function replyChatMessage(senderId, messageId, content, replyInThread = false) {
    try {
        // 构造请求参数
        const request = {
            message_id: messageId,
            content: JSON.stringify({
                text: `<at user_id="${senderId}"></at> ${content}`
            }),
            msg_type: 'text',
            reply_in_thread: replyInThread,
        };

        // 发起请求
        const response = await client.im.message.reply(request);

        // 处理失败返回
        if (response.code !== 0) {
            console.error(`client.im.message.reply failed, code: ${response.code}, msg: ${response.msg}, resp: ${JSON.stringify(response, null, 4)}`);
            return;
        }

        // 处理业务结果
        return response.data;

    } catch (error) {
        console.error('回复群聊消息失败', error);
    }
}

/**
 * 回复群聊卡片消息
 * @param {string} senderId - 发送者ID
 * @param {string} messageId - 消息ID
 * @param {string} content - 回复内容
 * @param {string} color - 卡片颜色（默认green）
 * @param {boolean} replyInThread - 是否在话题中回复（默认false）
 * @param {string} extraContent - 额外内容（可选）
 */
export async function replyChatCard(senderId, messageId, content, color = 'green', replyInThread = false, extraContent = '') {
    try {
        // 构造卡片元素
        const cardFooterElements = [
            { tag: 'hr' },
            {
                elements: [
                    {
                        content: '@海狗',
                        tag: 'lark_md',
                    }
                ],
                tag: 'note',
            },
        ];

        const cardElements = [
            {
                tag: 'div',
                text: {
                    content: `<at id="${senderId}"></at> \n ${content}`,
                    tag: 'lark_md',
                },
            },
        ];

        if (extraContent) {
            cardElements.push({
                tag: 'collapsible_panel',
                header: {
                    title: { tag: 'markdown', content: '**展开更多**' },
                },
                elements: [
                    {
                        tag: 'div',
                        text: {
                            content: extraContent,
                            tag: 'lark_md',
                        },
                    }
                ],
            });
        }

        cardElements.push(...cardFooterElements);

        const card = {
            config: { wide_screen_mode: true },
            header: {
                template: color,
                title: {
                    content: `岗位推荐 ${new Date().toLocaleString('zh-CN')}`,
                    tag: 'plain_text',
                },
            },
            elements: cardElements,
        };

        // 构造请求参数
        const request = {
            message_id: messageId,
            content: JSON.stringify(card),
            msg_type: 'interactive',
            reply_in_thread: replyInThread,
        };

        // 发起请求
        const response = await client.im.message.reply(request);

        // 处理失败返回
        if (response.code !== 0) {
            console.error(`client.im.message.reply failed, code: ${response.code}, msg: ${response.msg}, resp: ${JSON.stringify(response, null, 4)}`);
            return;
        }

        // 处理业务结果
        return response.data;

    } catch (error) {
        console.error('回复群聊卡片消息失败', error);
    }
}

/**
 * 下载消息文件
 * @param {string} messageId - 消息ID
 * @param {string} fileKey - 文件key
 * @param {string} downloadPath - 下载路径
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function downloadMessageFile(messageId, fileKey, downloadPath) {
    try {
        // 构造请求参数
        const request = {
            message_id: messageId,
            file_key: fileKey,
            type: 'file',
        };

        // 发起请求
        const response = await client.im.messageResource.get(request);

        // 处理失败返回
        if (response.code !== 0) {
            console.error(`client.im.messageResource.get failed, code: ${response.code}, msg: ${response.msg}, resp: ${JSON.stringify(response, null, 4)}`);
            return {
                success: false,
                message: `下载文件失败, code: ${response.code}, msg: ${response.msg}`
            };
        }

        // 处理业务结果 - 保存文件
        await fs.promises.writeFile(downloadPath, response.file);

        return {
            success: true,
            message: `下载文件成功, 保存路径: ${downloadPath}`
        };

    } catch (error) {
        console.error('下载消息文件失败', error);
        return {
            success: false,
            message: `下载文件失败: ${error.message}`
        };
    }
}

export async function sendLog(content, color = 'red', title = '异常告警') {
    if (!DEBUG_CHAT_ID) {
        console.warn('DEBUG_CHAT_ID 未配置，跳过日志发送');
        return;
    }

    try {
        await sendChatCard(DEBUG_CHAT_ID, content, color, title);
    } catch (error) {
        console.error('发送日志失败', error);
    }
}