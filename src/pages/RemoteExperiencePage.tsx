import { useState } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, BookmarkCheck, Eye, Calendar, Tag } from 'lucide-react'

interface Post {
  id: string
  title: string
  content: string
  author: {
    name: string
    avatar: string
    title: string
    company: string
  }
  category: string
  tags: string[]
  publishDate: string
  readTime: string
  likes: number
  comments: number
  views: number
  isLiked: boolean
  isBookmarked: boolean
  image?: string
}

const mockPosts: Post[] = [
  {
    id: '1',
    title: '远程工作5年的心得：如何保持高效与工作生活平衡',
    content: '作为一名远程工作了5年的前端工程师，我想分享一些关于如何在家工作保持高效的经验。首先，建立固定的工作空间非常重要...',
    author: {
      name: '李明',
      avatar: 'LM',
      title: '高级前端工程师',
      company: '字节跳动'
    },
    category: '工作心得',
    tags: ['远程工作', '效率提升', '工作生活平衡'],
    publishDate: '2024-01-15',
    readTime: '8分钟',
    likes: 156,
    comments: 23,
    views: 1240,
    isLiked: false,
    isBookmarked: false,
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400'
  },
  {
    id: '2',
    title: '数字游民生活指南：边旅行边工作的实用技巧',
    content: '过去两年我一直过着数字游民的生活，走过了20多个国家。今天想和大家分享一些实用的技巧，包括如何选择工作地点、时间管理等...',
    author: {
      name: '王小雨',
      avatar: 'WXY',
      title: 'UI/UX设计师',
      company: '自由职业者'
    },
    category: '数字游民',
    tags: ['数字游民', '旅行工作', '自由职业'],
    publishDate: '2024-01-14',
    readTime: '12分钟',
    likes: 289,
    comments: 45,
    views: 2180,
    isLiked: true,
    isBookmarked: true,
    image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400'
  },
  {
    id: '3',
    title: '远程团队协作工具推荐：提升团队效率的10个神器',
    content: '管理一个20人的远程团队两年来，我们尝试了各种协作工具。今天推荐10个真正提升团队效率的工具，包括沟通、项目管理、文档协作等...',
    author: {
      name: '张伟',
      avatar: 'ZW',
      title: '产品经理',
      company: '腾讯'
    },
    category: '工具推荐',
    tags: ['团队协作', '效率工具', '项目管理'],
    publishDate: '2024-01-13',
    readTime: '15分钟',
    likes: 342,
    comments: 67,
    views: 3250,
    isLiked: false,
    isBookmarked: false,
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400'
  },
  {
    id: '4',
    title: '从零开始的远程工作：新手必知的10个注意事项',
    content: '刚开始远程工作的朋友们经常会遇到各种问题。作为过来人，我总结了10个新手必须知道的注意事项，帮助大家快速适应远程工作模式...',
    author: {
      name: '陈思思',
      avatar: 'CSS',
      title: '全栈工程师',
      company: '阿里巴巴'
    },
    category: '新手指南',
    tags: ['远程工作', '新手指南', '职场建议'],
    publishDate: '2024-01-12',
    readTime: '10分钟',
    likes: 198,
    comments: 34,
    views: 1680,
    isLiked: false,
    isBookmarked: true,
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400'
  },
  {
    id: '5',
    title: '远程面试攻略：如何在视频面试中脱颖而出',
    content: '远程面试已经成为主流，但很多人还不知道如何在视频面试中展现最好的自己。本文分享一些实用的远程面试技巧和注意事项...',
    author: {
      name: '刘强',
      avatar: 'LQ',
      title: 'HR总监',
      company: '美团'
    },
    category: '面试技巧',
    tags: ['远程面试', '求职技巧', '职业发展'],
    publishDate: '2024-01-11',
    readTime: '7分钟',
    likes: 267,
    comments: 52,
    views: 2340,
    isLiked: true,
    isBookmarked: false,
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400'
  },
  {
    id: '6',
    title: '远程工作的健康管理：如何避免久坐带来的健康问题',
    content: '长期远程工作容易导致各种健康问题。作为一名关注员工健康的HR，我想分享一些保持身心健康的实用方法和建议...',
    author: {
      name: '赵丽娜',
      avatar: 'ZLN',
      title: '健康管理师',
      company: '京东健康'
    },
    category: '健康管理',
    tags: ['健康管理', '远程工作', '生活方式'],
    publishDate: '2024-01-10',
    readTime: '9分钟',
    likes: 145,
    comments: 28,
    views: 1120,
    isLiked: false,
    isBookmarked: false,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400'
  }
]

const categories = [
  { value: 'all', label: '全部分类' },
  { value: '工作心得', label: '工作心得' },
  { value: '数字游民', label: '数字游民' },
  { value: '工具推荐', label: '工具推荐' },
  { value: '新手指南', label: '新手指南' },
  { value: '面试技巧', label: '面试技巧' },
  { value: '健康管理', label: '健康管理' }
]

export default function RemoteExperiencePage() {
  const [posts, setPosts] = useState<Post[]>(mockPosts)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('latest') // latest, popular, mostLiked

  const filteredPosts = posts.filter(post => 
    selectedCategory === 'all' || post.category === selectedCategory
  ).sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return b.views - a.views
      case 'mostLiked':
        return b.likes - a.likes
      default: // latest
        return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    }
  })

  const toggleLike = (postId: string) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            isLiked: !post.isLiked,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1
          } 
        : post
    ))
  }

  const toggleBookmark = (postId: string) => {
    setPosts(posts.map(post => 
      post.id === postId ? { ...post, isBookmarked: !post.isBookmarked } : post
    ))
  }

  const getCategoryColor = (category: string) => {
    const colorMap: { [key: string]: string } = {
      '工作心得': 'bg-blue-100 text-blue-800',
      '数字游民': 'bg-green-100 text-green-800',
      '工具推荐': 'bg-purple-100 text-purple-800',
      '新手指南': 'bg-yellow-100 text-yellow-800',
      '面试技巧': 'bg-red-100 text-red-800',
      '健康管理': 'bg-pink-100 text-pink-800'
    }
    return colorMap[category] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">远程经验</h1>
          <p className="mt-2 text-gray-600">分享远程工作经验，学习最佳实践</p>
        </div>

        {/* 筛选和排序 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            {/* 分类筛选 */}
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.value
                      ? 'bg-haigoo-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {/* 排序选项 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">排序：</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-haigoo-primary focus:border-transparent"
              >
                <option value="latest">最新发布</option>
                <option value="popular">最多浏览</option>
                <option value="mostLiked">最多点赞</option>
              </select>
            </div>
          </div>
        </div>

        {/* 帖子网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <article key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* 封面图片 */}
              {post.image && (
                <div className="aspect-video bg-gray-200 overflow-hidden">
                  <img 
                    src={post.image} 
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-6">
                {/* 分类标签 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(post.category)}`}>
                    {post.category}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>{post.publishDate}</span>
                  </div>
                </div>

                {/* 标题 */}
                <h2 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2 hover:text-haigoo-primary cursor-pointer">
                  {post.title}
                </h2>

                {/* 内容摘要 */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {post.content}
                </p>

                {/* 标签 */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {post.tags.slice(0, 3).map((tag, index) => (
                    <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 作者信息 */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  <div className="w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center text-white text-sm">
                    {post.author.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{post.author.name}</p>
                    <p className="text-xs text-gray-500 truncate">{post.author.title} @ {post.author.company}</p>
                  </div>
                </div>

                {/* 互动数据 */}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{post.views}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      <span>{post.comments}</span>
                    </div>
                  </div>
                  <span>{post.readTime}</span>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                        post.isLiked
                          ? 'bg-red-50 text-red-600'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                      <span>{post.likes}</span>
                    </button>
                    <button className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                      <Share2 className="h-4 w-4" />
                      <span>分享</span>
                    </button>
                  </div>
                  <button
                    onClick={() => toggleBookmark(post.id)}
                    className="p-2 text-gray-400 hover:text-haigoo-primary transition-colors"
                  >
                    {post.isBookmarked ? (
                      <BookmarkCheck className="h-5 w-5 text-haigoo-primary" />
                    ) : (
                      <Bookmark className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* 空状态 */}
        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <MessageCircle className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无相关内容</h3>
            <p className="text-gray-600">尝试选择其他分类或稍后再来看看</p>
          </div>
        )}

        {/* 加载更多 */}
        {filteredPosts.length > 0 && (
          <div className="text-center mt-12">
            <button className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              加载更多内容
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
