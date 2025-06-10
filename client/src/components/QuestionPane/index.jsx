import { useState } from 'react';
import TestCases from './TestCases';
import { 
  XMarkIcon,
  ClockIcon,
  AcademicCapIcon,
  InformationCircleIcon,
  BeakerIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

export default function QuestionPane({ question, onClose }) {
  const [activeTab, setActiveTab] = useState('description');

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-white">
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 border-b border-gray-200/50 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <InformationCircleIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Problem Statement
            </h2>
            <p className="text-xs text-gray-500">Read carefully before coding</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 hover:scale-110"
            title="Hide instructions"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Question metadata */}
      <div className="p-4 bg-white border-b border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-4 leading-tight">{question.title}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-full border border-gray-200">
            <ClockIcon className="w-4 h-4 text-orange-500" />
            <span className="font-medium">{Math.floor(question.timeLimit / 60)} minutes</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-full border border-gray-200">
            <AcademicCapIcon className="w-4 h-4 text-blue-500" />
            <span className="font-medium">{question.testCases?.reduce((sum, tc) => sum + tc.points, 0) || 100} points</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('description')}
          className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium transition-all duration-300 ${
            activeTab === 'description'
              ? 'text-indigo-600 bg-white border-b-2 border-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <DocumentTextIcon className="w-4 h-4" />
          <span>Description</span>
        </button>
        <button
          onClick={() => setActiveTab('testcases')}
          className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium transition-all duration-300 ${
            activeTab === 'testcases'
              ? 'text-indigo-600 bg-white border-b-2 border-indigo-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <BeakerIcon className="w-4 h-4" />
          <span>Test Cases</span>
          <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-1 rounded-full font-semibold">
            {question.testCases?.length || 0}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'description' && (
          <div className="p-6 fade-in-up">
            <div 
              className="prose prose-sm max-w-none leading-relaxed text-[15px]"
              dangerouslySetInnerHTML={{ __html: question.description }}
            />
          </div>
        )}
        {activeTab === 'testcases' && (
          <div className="fade-in-up">
            <TestCases testCases={question.testCases || []} />
          </div>
        )}
      </div>
    </div>
  );
}