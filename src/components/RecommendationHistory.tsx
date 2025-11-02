import React, { useState, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, Briefcase, TrendingUp, Archive, Eye, X } from 'lucide-react'
import { recommendationHistoryService, DailyRecommendation } from '../services/recommendation-history-service'
import { Job } from '../types'
import RecommendationCard from './RecommendationCard'

interface RecommendationHistoryProps {
  isOpen: boolean
  onClose: () => void
  onJobClick?: (job: Job) => void
}

export default function RecommendationHistory({ isOpen, onClose, onJobClick }: RecommendationHistoryProps) {
  const [pastRecommendations, setPastRecommendations] = useState<DailyRecommendation[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedDayData, setSelectedDayData] = useState<DailyRecommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // 加载历史数据
  useEffect(() => {
    if (isOpen) {
      loadHistoryData()
    }
  }, [isOpen])

  const loadHistoryData = () => {
    setLoading(true)
    try {
      const history = recommendationHistoryService.getPastRecommendations(7)
      setPastRecommendations(history)
      
      // 默认选择最近的一天
      if (history.length > 0) {
        setSelectedDate(history[0].date)
        setSelectedDayData(history[0])
      }
    } catch (error) {
      console.error('加载历史数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDateSelect = (date: string) => {
    const dayData = pastRecommendations.find(day => day.date === date)
    setSelectedDate(date)
    setSelectedDayData(dayData || null)
    setCurrentIndex(0) // 重置到第一个职位
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (selectedDayData && currentIndex < selectedDayData.jobs.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleJobClick = (job: Job) => {
    if (onJobClick) {
      onJobClick(job)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">过往推荐</h2>
                <p className="text-white/80 text-sm">回顾前7天的精选职位推荐</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* 左侧日期选择 */}
          <div className="w-80 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">选择日期</h3>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                </div>
              ) : pastRecommendations.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">暂无历史推荐数据</p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                    系统会自动保存每日推荐
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pastRecommendations.map((day) => {
                    const isSelected = selectedDate === day.date
                    const displayDate = recommendationHistoryService.formatDateDisplay(day.date)
                    const relativeTime = recommendationHistoryService.getRelativeTimeDescription(day.date)
                    
                    return (
                      <button
                        key={day.date}
                        onClick={() => handleDateSelect(day.date)}
                        className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
                          isSelected
                            ? 'bg-violet-100 dark:bg-violet-900/30 border-2 border-violet-300 dark:border-violet-600'
                            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-medium ${
                            isSelected ? 'text-violet-900 dark:text-violet-100' : 'text-gray-900 dark:text-white'
                          }`}>
                            {displayDate}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            isSelected 
                              ? 'bg-violet-200 dark:bg-violet-800 text-violet-800 dark:text-violet-200'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          }`}>
                            {relativeTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            <span className={isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-400'}>
                              {day.jobs.length} 个职位
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span className={isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-400'}>
                              {new Date(day.updateTime).toLocaleTimeString('zh-CN', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 右侧职位展示 */}
          <div className="flex-1 overflow-y-auto">
            {selectedDayData ? (
              <div className="p-8">
                {/* 日期信息头部 */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {recommendationHistoryService.formatDateDisplay(selectedDayData.date)}的推荐
                      </h3>
                      <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>共 {selectedDayData.jobs.length} 个精选职位</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            更新于 {new Date(selectedDayData.updateTime).toLocaleString('zh-CN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 职位导航 */}
                    {selectedDayData.jobs.length > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrevious}
                          disabled={currentIndex === 0}
                          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium">
                          {currentIndex + 1} / {selectedDayData.jobs.length}
                        </span>
                        <button
                          onClick={handleNext}
                          disabled={currentIndex === selectedDayData.jobs.length - 1}
                          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 职位卡片展示 */}
                {selectedDayData.jobs.length > 0 ? (
                  <div className="max-w-4xl">
                    <RecommendationCard
                      job={selectedDayData.jobs[currentIndex]}
                      onClick={handleJobClick}
                      className="transform hover:scale-[1.02] transition-transform duration-200"
                    />
                    
                    {/* 职位指示器 */}
                    {selectedDayData.jobs.length > 1 && (
                      <div className="flex justify-center mt-6 gap-2">
                        {selectedDayData.jobs.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-3 h-3 rounded-full transition-all duration-200 ${
                              index === currentIndex
                                ? 'bg-violet-600 scale-125'
                                : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      该日期暂无推荐数据
                    </h3>
                    <p className="text-gray-500 dark:text-gray-500">
                      请选择其他日期查看推荐职位
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    选择日期查看推荐
                  </h3>
                  <p className="text-gray-500 dark:text-gray-500">
                    从左侧选择一个日期来查看当天的推荐职位
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}